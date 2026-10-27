const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const readline = require('readline');
const mongoose = require('mongoose');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function listAndCleanAllZeroDemandDeclarations() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB.\n');

    const db = mongoose.connection.db;

    // 1. Fetch all Fee Heads
    const feeHeads = await db.collection('feeheads').find({}).toArray();
    const feeHeadMap = new Map();
    feeHeads.forEach(h => feeHeadMap.set(String(h._id), h.name));

    // 2. Find ALL StudentFee demands across ANY fee head where amount == 0
    console.log('Scanning for all StudentFee demands where amount = 0...');
    const zeroDemands = await db.collection('studentfees')
      .find({ amount: 0 })
      .toArray();

    console.log(`Found ${zeroDemands.length} demands with amount = 0 across all fee heads.\n`);

    if (zeroDemands.length === 0) {
      console.log('No zero demands found in studentfees.');
      rl.close();
      await mongoose.disconnect();
      return;
    }

    // Build lookup set: `${studentId}_${feeHeadId}_${studentYear}`
    const zeroDemandSet = new Set();
    zeroDemands.forEach(d => {
      const fhId = String(d.feeHead);
      zeroDemandSet.add(`${d.studentId}_${fhId}_${d.studentYear}`);
    });

    // 3. Find any declaration transactions (DEMD or DECL)
    console.log('Finding declaration and extra demand transactions on these zero demands...');
    const allDeclTxns = await db.collection('transactions')
      .find({
        remarks: { $in: ['Extra Demand as per declaration', 'Concession as per declaration'] }
      })
      .toArray();

    // 4. Filter txns where the student's demand for that feeHead + year is 0
    const problematicTxns = allDeclTxns.filter(t => {
      const fhId = String(t.feeHead);
      const key = `${t.studentId}_${fhId}_${t.studentYear}`;
      return zeroDemandSet.has(key);
    });

    console.log(`========================================================================`);
    console.log(` Found ${problematicTxns.length} declaration transactions on ANY fee head where demand is ₹0:`);
    console.log(`========================================================================\n`);

    if (problematicTxns.length === 0) {
      console.log('No conflict transactions found! All zero demands are clean.');
      rl.close();
      await mongoose.disconnect();
      return;
    }

    const summary = [];
    for (const t of problematicTxns) {
      const student = await db.collection('students').findOne({
        $or: [{ studentId: t.studentId }, { admissionNumber: t.studentId }, { pinNumber: t.studentId }]
      });

      const fhName = feeHeadMap.get(String(t.feeHead)) || String(t.feeHead);

      summary.push({
        'Receipt No': t.receiptNumber || 'N/A',
        'Adm No': t.studentId,
        'Name': student ? student.name : (t.studentName || 'Unknown'),
        'PIN': student ? student.pinNumber : '-',
        'Fee Head': fhName,
        'Yr': t.studentYear,
        'Type': t.transactionType,
        'Amount': `₹${Number(t.amount || 0).toLocaleString('en-IN')}`,
        'Remarks': t.remarks,
        'Status': t.status || 'active',
        'Date': t.paymentDate ? new Date(t.paymentDate).toLocaleDateString('en-IN') : 'N/A'
      });
    }

    console.table(summary);

    console.log('\n-----------------------------------------------------------');
    console.log(`⚠️  Would you like to permanently DELETE these ${problematicTxns.length} transactions?`);
    console.log('    This will remove all phantom demands and concessions on 0-demand dues.');
    console.log('-----------------------------------------------------------\n');

    const answer = await askQuestion('Type "DELETE" to permanently delete them, or press Enter to skip: ');

    if (answer.trim() === 'DELETE') {
      const targetIds = problematicTxns.map(t => t._id);
      const res = await db.collection('transactions').deleteMany({
        _id: { $in: targetIds }
      });
      console.log(`\n✓ Successfully deleted ${res.deletedCount} transactions.`);
    } else {
      console.log('\nAction cancelled. No transactions deleted.');
    }

    rl.close();
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB.');
  } catch (err) {
    console.error('Error during execution:', err);
    rl.close();
    process.exit(1);
  }
}

listAndCleanAllZeroDemandDeclarations();

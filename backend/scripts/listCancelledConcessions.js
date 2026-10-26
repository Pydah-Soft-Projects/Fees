const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const readline = require('readline');
const mongoose = require('mongoose');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function manageCancelledConcessions() {
  try {
    console.log('===========================================================');
    console.log('   CANCELLED CONCESSION / DECLARATION TRANSACTIONS SCRIPT');
    console.log('   (List -> Confirm Hard Delete)');
    console.log('===========================================================\n');

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB.\n');

    const db = mongoose.connection.db;

    // Query for cancelled concession / declaration transactions
    const query = {
      $or: [
        { receiptNumber: /^DECL/i },
        { remarks: /concession/i },
        { cancellationReason: /concession|revised fee/i },
        { transactionType: 'CREDIT' }
      ],
      status: 'cancelled'
    };

    const cancelledTxns = await db.collection('transactions')
      .find(query)
      .sort({ cancelledAt: -1, createdAt: -1 })
      .toArray();

    console.log(`Found ${cancelledTxns.length} cancelled concession/declaration transactions.\n`);

    if (cancelledTxns.length === 0) {
      console.log('No cancelled concession transactions found.');
      rl.close();
      await mongoose.disconnect();
      return;
    }

    const summary = [];
    const targetIds = [];

    for (const t of cancelledTxns) {
      targetIds.push(t._id);

      const student = await db.collection('students').findOne({
        $or: [
          { studentId: t.studentId },
          { admissionNumber: t.studentId },
          { pinNumber: t.studentId }
        ]
      });

      let feeHeadName = 'N/A';
      if (t.feeHead) {
        try {
          const feeHeadObjId = typeof t.feeHead === 'string' ? new mongoose.Types.ObjectId(t.feeHead) : t.feeHead;
          const fh = await db.collection('feeheads').findOne({ _id: feeHeadObjId });
          if (fh) feeHeadName = `${fh.name} (${fh.code || ''})`;
          else feeHeadName = String(t.feeHead);
        } catch (e) {
          feeHeadName = String(t.feeHead);
        }
      }

      const cancelledDate = t.cancelledAt ? new Date(t.cancelledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A';

      summary.push({
        'Receipt No': t.receiptNumber || 'N/A',
        'Adm No': t.studentId || 'N/A',
        'Student Name': student ? student.name : 'Unknown',
        'PIN': student ? student.pinNumber : 'Unknown',
        'Course': student ? student.course : '',
        'Branch': student ? student.branch : '',
        'Yr': t.studentYear || 'N/A',
        'Fee Head': feeHeadName,
        'Amount': `₹${Number(t.amount || 0).toLocaleString('en-IN')}`,
        'Cancelled At': cancelledDate,
        'Cancelled By': t.cancelledByName || t.cancelledBy || 'System',
        'Reason': t.cancellationReason || t.remarks || 'N/A'
      });
    }

    console.table(summary);

    // Summary counts grouped by reason
    const reasonCounts = {};
    for (const item of summary) {
      reasonCounts[item.Reason] = (reasonCounts[item.Reason] || 0) + 1;
    }

    console.log('\n--- Breakdown by Cancellation Reason ---');
    console.table(
      Object.entries(reasonCounts).map(([reason, count]) => ({
        Reason: reason,
        Count: count
      }))
    );

    // Prompt user for confirmation before hard deletion
    console.log('\n-----------------------------------------------------------');
    console.log(`⚠️  WARNING: You are about to permanently HARD-DELETE all ${targetIds.length} records from the 'transactions' collection.`);
    console.log('    This action cannot be undone.');
    console.log('-----------------------------------------------------------\n');

    const confirmation = await askQuestion(
      `Type "DELETE" (in capital letters) to permanently delete these ${targetIds.length} transactions, or anything else to cancel: `
    );

    if (confirmation.trim() === 'DELETE') {
      console.log(`\nDeleting ${targetIds.length} transactions...`);
      const deleteResult = await db.collection('transactions').deleteMany({
        _id: { $in: targetIds }
      });
      console.log(`✓ Successfully hard-deleted ${deleteResult.deletedCount} cancelled transactions from the database.`);
    } else {
      console.log('\nAction cancelled. No transactions were deleted.');
    }

    rl.close();
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB.');
  } catch (error) {
    console.error('Error during execution:', error);
    rl.close();
    process.exit(1);
  }
}

manageCancelledConcessions();

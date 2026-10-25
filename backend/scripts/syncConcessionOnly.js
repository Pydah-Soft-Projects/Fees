const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const readline = require('readline');
const mongoose = require('mongoose');
const db = require('../config/sqlDb');
const OverallConcessionRequest = require('../models/OverallConcessionRequest');
const Transaction = require('../models/Transaction');
const FeeHead = require('../models/FeeHead');
const { syncStandardFees } = require('../services/studentFeeSyncService');
const { applyRevisedConcessionTransactions } = require('../services/overallConcessionRevisedService');
const { normalizeConcessionType, resolveFeeHeadId, buildFeeHeadMaps } = require('../utils/overallConcessionFees');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));
const formatInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

async function syncConcessionsOnly() {
  try {
    console.log('===========================================================');
    console.log('   CONCESSION-ONLY TRANSACTION SYNC SCRIPT');
    console.log('   (Preview First -> Confirm -> Sync)');
    console.log('===========================================================\n');

    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB.\n');

    const feeHeads = await FeeHead.find({}).lean();
    const { codeMap } = buildFeeHeadMaps(feeHeads);

    // 1. Find all approved concession requests that have at least one CONCESSION type entry
    const requestsWithConcessionType = await OverallConcessionRequest.find({
      status: 'APPROVED',
      'concessions.concessionType': 'CONCESSION'
    }).lean();

    if (requestsWithConcessionType.length === 0) {
      console.log('No approved concession requests with "CONCESSION" type found.');
      rl.close();
      process.exit(0);
    }

    // 2. Build the preview table
    console.log(`Found ${requestsWithConcessionType.length} approved request(s) with "CONCESSION" type entries.`);
    console.log('Scanning current transaction status for these entries...\n');

    const previewList = [];

    for (const req of requestsWithConcessionType) {
      const adm = req.admissionNumber;
      const concessionEntries = (req.concessions || []).filter(c =>
        normalizeConcessionType(c.concessionType) === 'CONCESSION' && Number(c.amount) > 0
      );

      for (const c of concessionEntries) {
        const feeHeadId = resolveFeeHeadId(c, codeMap) || String(c.feeHeadId || '');
        const studentYear = Number(c.studentYear);
        const amount = Number(c.amount) || 0;

        const fh = feeHeads.find(h => h._id.toString() === feeHeadId);
        const headLabel = fh ? `${fh.name} (${fh.code})` : (c.feeHeadCode || feeHeadId);

        // Check if an active credit transaction exists
        const txn = await Transaction.findOne({
          studentId: adm,
          feeHead: feeHeadId,
          studentYear: String(studentYear),
          transactionType: 'CREDIT',
          remarks: /declaration/i,
          status: { $ne: 'cancelled' }
        }).lean();

        previewList.push({
          req,
          adm,
          pin: req.pinNo || '-',
          name: req.studentName,
          course: `${req.course} (${req.branch})`,
          batch: req.batch,
          headLabel,
          feeHeadId,
          studentYear,
          amount,
          concessionType: c.concessionType,
          txnStatus: txn ? `Active (${txn.receiptNumber})` : 'MISSING (Will be created)',
          hasTxn: Boolean(txn)
        });
      }
    }

    // 3. Display preview table
    console.log('-----------------------------------------------------------');
    console.log('PREVIEW: STUDENTS & CONCESSION ENTRIES TO SYNC:');
    console.log('-----------------------------------------------------------');
    console.table(previewList.map((p, idx) => ({
      '#': idx + 1,
      'Admission No': p.adm,
      'PIN No': p.pin,
      'Student Name': p.name,
      'Course': p.course,
      'Batch': p.batch,
      'Fee Component': p.headLabel,
      'Year': p.studentYear,
      'Concession': formatInr(p.amount),
      'Transaction Status': p.txnStatus
    })));

    const missingCount = previewList.filter(p => !p.hasTxn).length;
    console.log(`\nSummary: ${previewList.length} total entry(ies) across ${requestsWithConcessionType.length} student(s).`);
    console.log(`Entries needing transaction creation: ${missingCount}`);

    // 4. Ask confirmation
    const answer = await askQuestion('\nDo you want to proceed and sync these concession transactions? (yes/no): ');

    if (!/^yes$/i.test(answer.trim()) && !/^y$/i.test(answer.trim())) {
      console.log('\n❌ Operation cancelled by user. No transactions were created or modified.');
      rl.close();
      process.exit(0);
    }

    // 5. Execute Sync
    console.log('\n===========================================================');
    console.log('EXECUTING SYNC...');
    console.log('===========================================================\n');

    let processedCount = 0;
    for (const req of requestsWithConcessionType) {
      const adm = req.admissionNumber;
      console.log(`>>> Syncing Student: ${adm} - ${req.studentName}`);

      let studentObj = null;
      try {
        const [rows] = await db.query('SELECT * FROM students WHERE admission_number = ?', [adm]);
        if (rows && rows.length > 0) studentObj = rows[0];
      } catch (err) {
        console.warn(`    ⚠️ SQL lookup note for ${adm}:`, err.message);
      }

      if (studentObj) {
        const syncRes = await syncStandardFees(studentObj, adm, feeHeads);
        console.log(`    ✓ Synced standard fees & concessions (matched=${syncRes.structuresMatched})`);
      } else {
        const concessionEntries = (req.concessions || []).filter(c => Number(c.amount) > 0);
        const applyRes = await applyRevisedConcessionTransactions({
          admissionNumber: adm,
          studentName: req.studentName,
          college: req.college,
          course: req.course,
          branch: req.branch,
          batch: req.batch,
          category: req.category || 'Regular',
          entries: concessionEntries,
          collectedBy: 'SCRIPT_CONCESSION_SYNC',
          collectedByName: 'Concession Sync Script'
        });
        console.log(`    ✓ Applied concession transactions (created=${applyRes.created}, updated=${applyRes.updated})`);
      }

      // Show confirmed transactions
      const txns = await Transaction.find({
        studentId: adm,
        transactionType: 'CREDIT',
        remarks: /declaration/i,
        status: { $ne: 'cancelled' }
      }).lean();

      txns.forEach(t => {
        console.log(`      ✓ Receipt: ${t.receiptNumber} | Year: ${t.studentYear} | Amount: ${formatInr(t.amount)} | Status: ${t.status}`);
      });
      console.log('');
      processedCount++;
    }

    console.log('===========================================================');
    console.log(`✓ COMPLETED: Successfully synced ${processedCount} student(s)!`);
    console.log('===========================================================');
    rl.close();
    process.exit(0);

  } catch (error) {
    console.error('Error during concession sync:', error);
    rl.close();
    process.exit(1);
  }
}

syncConcessionsOnly();

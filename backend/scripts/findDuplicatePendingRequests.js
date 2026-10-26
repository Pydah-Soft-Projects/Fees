const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const readline = require('readline');
const mongoose = require('mongoose');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

async function findDuplicatePendingRequests() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✓ Connected to MongoDB.\n');

    const db = mongoose.connection.db;

    // 1. Fetch all PENDING requests
    const pendingRequests = await db.collection('overallconcessionrequests')
      .find({ status: 'PENDING' })
      .toArray();

    console.log(`Found ${pendingRequests.length} total PENDING requests. Analyzing against APPROVED requests...\n`);

    const duplicatePendingList = [];

    for (const pending of pendingRequests) {
      // Find an approved request for the same student
      const approved = await db.collection('overallconcessionrequests').findOne({
        admissionNumber: pending.admissionNumber,
        status: 'APPROVED'
      });

      if (!approved) continue;

      const appConcessions = approved.concessions || [];
      const pendConcessions = pending.concessions || [];

      if (appConcessions.length === 0 || pendConcessions.length === 0) continue;

      // Build key -> details map
      const approvedMap = new Map();
      appConcessions.forEach(c => {
        const key = `${c.feeHeadId}_${c.studentYear}_${c.semester ?? 'null'}`;
        approvedMap.set(key, {
          amount: Number(c.amount ?? c.revisedAmount ?? 0),
          concessionType: String(c.concessionType || 'CONCESSION').toUpperCase(),
          remarks: c.remarks || ''
        });
      });

      const pendingMap = new Map();
      pendConcessions.forEach(c => {
        const key = `${c.feeHeadId}_${c.studentYear}_${c.semester ?? 'null'}`;
        pendingMap.set(key, {
          amount: Number(c.amount ?? c.revisedAmount ?? 0),
          concessionType: String(c.concessionType || 'CONCESSION').toUpperCase(),
          remarks: c.remarks || ''
        });
      });

      // Check if fee heads, years, concession types and amounts match 100%
      let sameStructure = approvedMap.size === pendingMap.size;
      let amountsIdentical = sameStructure;

      if (sameStructure) {
        for (const [key, p] of pendingMap.entries()) {
          const a = approvedMap.get(key);
          if (!a || a.amount !== p.amount || a.concessionType !== p.concessionType) {
            amountsIdentical = false;
            break;
          }
        }
      }

      if (amountsIdentical) {
        // Collect remarks differences
        const remarksDiff = [];
        for (const [key, p] of pendingMap.entries()) {
          const a = approvedMap.get(key);
          if (p.remarks !== a.remarks) {
            remarksDiff.push(`Yr ${key.split('_')[1]}: "${a.remarks || 'none'}" -> "${p.remarks || 'none'}"`);
          }
        }
        if (pending.remarks !== approved.remarks && pending.remarks) {
          remarksDiff.push(`Request Remark: "${approved.remarks || 'none'}" -> "${pending.remarks}"`);
        }

        duplicatePendingList.push({
          pendingId: pending._id,
          approvedId: approved._id,
          admissionNumber: pending.admissionNumber,
          pinNo: pending.pinNo || '-',
          studentName: pending.studentName || 'Unknown',
          course: pending.course || '',
          branch: pending.branch || '',
          batch: pending.batch || '',
          headsCount: pendConcessions.length,
          requestedBy: pending.requestedBy || 'Unknown',
          requestedAt: pending.createdAt ? new Date(pending.createdAt).toLocaleDateString('en-IN') : 'N/A',
          remarksDiff: remarksDiff.length > 0 ? remarksDiff.join(' | ') : 'Identical (Exact duplicate)'
        });
      }
    }

    console.log(`========================================================================`);
    console.log(` Found ${duplicatePendingList.length} PENDING requests with IDENTICAL amounts to APPROVED requests`);
    console.log(`========================================================================\n`);

    if (duplicatePendingList.length === 0) {
      console.log('No duplicate pending requests found.');
      rl.close();
      await mongoose.disconnect();
      return;
    }

    console.table(duplicatePendingList.map(item => ({
      'Adm No': item.admissionNumber,
      'PIN': item.pinNo,
      'Name': item.studentName,
      'Course': item.course,
      'Batch': item.batch,
      'Entries': item.headsCount,
      'Requested By': item.requestedBy,
      'Date': item.requestedAt,
      'Remarks Difference': item.remarksDiff
    })));

    // Interactive confirmation prompt to clean them up if desired
    console.log('\n-----------------------------------------------------------');
    console.log(`Would you like to resolve all ${duplicatePendingList.length} duplicate pending requests?`);
    console.log('This will:');
    console.log(' 1. Copy any newer remarks from the pending requests to their approved concessions.');
    console.log(' 2. Delete the redundant PENDING requests so they no longer show as pending in UI.');
    console.log('-----------------------------------------------------------\n');

    const answer = await askQuestion('Type "CLEAN" to merge remarks & delete these duplicates, or press Enter to skip: ');

    if (answer.trim() === 'CLEAN') {
      let resolvedCount = 0;
      for (const item of duplicatePendingList) {
        const pending = await db.collection('overallconcessionrequests').findOne({ _id: item.pendingId });
        const approved = await db.collection('overallconcessionrequests').findOne({ _id: item.approvedId });

        if (pending && approved) {
          // Merge remarks from pending to approved
          const pendMap = new Map();
          (pending.concessions || []).forEach(c => {
            pendMap.set(`${c.feeHeadId}_${c.studentYear}_${c.semester ?? 'null'}`, c.remarks);
          });

          approved.concessions = (approved.concessions || []).map(c => {
            const key = `${c.feeHeadId}_${c.studentYear}_${c.semester ?? 'null'}`;
            if (pendMap.has(key) && pendMap.get(key)) {
              c.remarks = pendMap.get(key);
            }
            return c;
          });

          const updateFields = {
            concessions: approved.concessions
          };
          if (pending.remarks) {
            updateFields.remarks = pending.remarks;
          }

          // Use raw MongoDB driver updateOne so Mongoose does NOT touch updatedAt or any timestamp
          await db.collection('overallconcessionrequests').updateOne(
            { _id: approved._id },
            { $set: updateFields }
          );

          // Delete the redundant pending request
          await db.collection('overallconcessionrequests').deleteOne({ _id: item.pendingId });
          resolvedCount++;
        }
      }
      console.log(`\n✓ Successfully cleaned up ${resolvedCount} duplicate pending requests without modifying any dates, timestamps, or names.`);
    } else {
      console.log('\nNo changes made.');
    }

    rl.close();
    await mongoose.disconnect();
    console.log('✓ Disconnected from MongoDB.');
  } catch (error) {
    console.error('Error finding duplicate pending requests:', error);
    rl.close();
    process.exit(1);
  }
}

findDuplicatePendingRequests();

const path = require('path');
const dotenv = require('dotenv');
const readline = require('readline');

dotenv.config({ path: path.join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const db = require('../config/sqlDb');
const FeeHead = require('../models/FeeHead');
const FeeStructure = require('../models/FeeStructure');
const StudentFee = require('../models/StudentFee');
const Transaction = require('../models/Transaction');
const { syncLateFees } = require('../services/studentFeeSyncService');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query) => new Promise((resolve) => rl.question(query, resolve));

// Format currency
const formatInr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

async function main() {
  try {
    console.log('\n===============================================================');
    console.log('   EXCESS FEE REALLOCATION & AUTO-TRANSFER SCRIPT');
    console.log('===============================================================\n');

    await connectDB();
    console.log('✓ Connected to MongoDB');

    // -------------------------------------------------------------
    // Step 1: Select College
    // -------------------------------------------------------------
    console.log('\n--- STEP 1: SELECT COLLEGE ---');
    const colleges = await FeeStructure.distinct('college');
    const validColleges = colleges.filter(Boolean).sort();

    if (validColleges.length === 0) {
      console.log('No colleges found in Fee Structures.');
      process.exit(0);
    }

    validColleges.forEach((c, idx) => console.log(`  [${idx + 1}] ${c}`));
    const collegeAns = await askQuestion(`\nSelect College (1-${validColleges.length}) or [Q to quit]: `);
    if (/^q$/i.test(collegeAns.trim())) process.exit(0);
    const collegeIdx = parseInt(collegeAns.trim(), 10) - 1;
    if (isNaN(collegeIdx) || collegeIdx < 0 || collegeIdx >= validColleges.length) {
      console.log('Invalid selection.');
      process.exit(1);
    }
    const selectedCollege = validColleges[collegeIdx];
    console.log(`✓ Selected College: ${selectedCollege}`);

    // -------------------------------------------------------------
    // Step 2: Select Course
    // -------------------------------------------------------------
    console.log('\n--- STEP 2: SELECT COURSE ---');
    const courses = await FeeStructure.distinct('course', { college: selectedCollege });
    const validCourses = courses.filter(Boolean).sort();

    if (validCourses.length === 0) {
      console.log(`No courses found for college: ${selectedCollege}`);
      process.exit(0);
    }

    validCourses.forEach((c, idx) => console.log(`  [${idx + 1}] ${c}`));
    const courseAns = await askQuestion(`\nSelect Course (1-${validCourses.length}) or [Q to quit]: `);
    if (/^q$/i.test(courseAns.trim())) process.exit(0);
    const courseIdx = parseInt(courseAns.trim(), 10) - 1;
    if (isNaN(courseIdx) || courseIdx < 0 || courseIdx >= validCourses.length) {
      console.log('Invalid selection.');
      process.exit(1);
    }
    const selectedCourse = validCourses[courseIdx];
    console.log(`✓ Selected Course: ${selectedCourse}`);

    // -------------------------------------------------------------
    // Step 3: Select Batch
    // -------------------------------------------------------------
    console.log('\n--- STEP 3: SELECT BATCH ---');
    const batches = await FeeStructure.distinct('batch', {
      college: selectedCollege,
      course: selectedCourse
    });
    const validBatches = batches.filter(Boolean).sort();

    if (validBatches.length === 0) {
      console.log(`No batches found for ${selectedCollege} - ${selectedCourse}`);
      process.exit(0);
    }

    validBatches.forEach((b, idx) => console.log(`  [${idx + 1}] ${b}`));
    const batchAns = await askQuestion(`\nSelect Batch (1-${validBatches.length}) or [Q to quit]: `);
    if (/^q$/i.test(batchAns.trim())) process.exit(0);
    const batchIdx = parseInt(batchAns.trim(), 10) - 1;
    if (isNaN(batchIdx) || batchIdx < 0 || batchIdx >= validBatches.length) {
      console.log('Invalid selection.');
      process.exit(1);
    }
    const selectedBatch = validBatches[batchIdx];
    console.log(`✓ Selected Batch: ${selectedBatch}`);

    // -------------------------------------------------------------
    // Step 4: Display Fee Structures
    // -------------------------------------------------------------
    console.log('\n--- STEP 4: FEE STRUCTURES DEFINED FOR THIS BATCH ---');
    const structures = await FeeStructure.find({
      college: selectedCollege,
      course: selectedCourse,
      batch: selectedBatch
    }).populate('feeHead').sort({ studentYear: 1, semester: 1 });

    if (structures.length === 0) {
      console.log('No fee structures found for this combination.');
      process.exit(0);
    }

    console.table(structures.map((s) => ({
      ID: String(s._id).slice(-6),
      FeeHead: s.feeHead?.name || 'Unknown',
      Branch: s.branch || 'ANY',
      Category: s.category || 'Regular',
      Year: s.studentYear,
      Semester: s.semester ?? 'All',
      Amount: formatInr(s.amount)
    })));

    // Optional: Filter by student year
    const distinctYears = Array.from(new Set(structures.map(s => Number(s.studentYear)))).sort((a, b) => a - b);
    console.log(`\nAvailable Student Year(s) in Structure: ${distinctYears.join(', ')}`);
    const yearAns = await askQuestion(`Filter by specific Student Year (${distinctYears.join('/')}) or press ENTER for all: `);
    const selectedYearFilter = yearAns.trim() ? parseInt(yearAns.trim(), 10) : null;

    // -------------------------------------------------------------
    // Step 5: Scan Students & Detect Overpayment / Deficits
    // -------------------------------------------------------------
    console.log('\n--- STEP 5: SCANNING STUDENTS & DETECTING EXCESS PAYMENTS ---');
    let studentSql = `
      SELECT id, admission_number, student_name, current_year, batch, college, course, branch, stud_type
      FROM students
      WHERE college = ? AND course = ? AND batch = ? AND LOWER(COALESCE(student_status, '')) = 'regular'
    `;
    const sqlParams = [selectedCollege, selectedCourse, selectedBatch];
    if (selectedYearFilter) {
      studentSql += ' AND current_year = ?';
      sqlParams.push(selectedYearFilter);
    }
    studentSql += ' ORDER BY admission_number ASC';

    const [students] = await db.query(studentSql, sqlParams);
    console.log(`Found ${students.length} student(s) matching context.\n`);

    if (students.length === 0) {
      console.log('No students found.');
      process.exit(0);
    }

    // Load all fee heads map
    const feeHeads = await FeeHead.find().lean();
    const feeHeadMap = new Map(feeHeads.map(fh => [String(fh._id), fh]));

    const plannedReallocations = []; // { student, sourceHead, targetHead, sourceTxn, amount }

    let studentsWithExcessCount = 0;

    // Pre-load all demands and transactions in bulk for high performance
    const allAdmissionNos = students.map(s => s.admission_number);
    console.log(`Pre-fetching fee demands and transactions for ${allAdmissionNos.length} student(s)...`);

    const [allDemands, allTxns] = await Promise.all([
      StudentFee.find({
        studentId: { $in: allAdmissionNos },
        isActive: { $ne: false }
      }).lean(),
      Transaction.find({
        studentId: { $in: allAdmissionNos },
        status: 'active'
      }).sort({ paymentDate: -1, createdAt: -1 }).lean()
    ]);

    // Group by studentId in Map for O(1) in-memory lookup
    const demandsByStudentMap = new Map();
    for (const d of allDemands) {
      const sId = String(d.studentId);
      if (!demandsByStudentMap.has(sId)) demandsByStudentMap.set(sId, []);
      demandsByStudentMap.get(sId).push(d);
    }

    const txnsByStudentMap = new Map();
    for (const t of allTxns) {
      const sId = String(t.studentId);
      if (!txnsByStudentMap.has(sId)) txnsByStudentMap.set(sId, []);
      txnsByStudentMap.get(sId).push(t);
    }

    console.log(`✓ Pre-fetched ${allDemands.length} demand records and ${allTxns.length} transactions across batch.\n`);

    for (const student of students) {
      const admissionNo = student.admission_number;
      const studentYear = Number(student.current_year) || 1;

      // 1. Filter demands for current year
      const rawDemands = demandsByStudentMap.get(admissionNo) || [];
      const demands = rawDemands.filter(d =>
        Number(d.studentYear) === studentYear || String(d.studentYear) === String(studentYear)
      );

      // Aggregate demand per fee head
      const demandByHead = new Map(); // feeHeadId -> number
      for (const d of demands) {
        const hid = String(d.feeHead);
        demandByHead.set(hid, (demandByHead.get(hid) || 0) + (Number(d.amount) || 0));
      }

      // If no StudentFee demands exist, check applicable FeeStructures
      if (demands.length === 0) {
        const applicableStructures = structures.filter(s =>
          Number(s.studentYear) === studentYear &&
          (!s.category || s.category === student.stud_type || s.category === 'Regular') &&
          (!s.branch || s.branch === 'ANY' || s.branch === student.branch)
        );
        for (const s of applicableStructures) {
          const hid = String(s.feeHead?._id || s.feeHead);
          demandByHead.set(hid, (demandByHead.get(hid) || 0) + (Number(s.amount) || 0));
        }
      }

      // 2. Filter active transactions for current year
      const rawTxns = txnsByStudentMap.get(admissionNo) || [];
      const txns = rawTxns.filter(t =>
        Number(t.studentYear) === studentYear || String(t.studentYear) === String(studentYear)
      );

      // Aggregate payments (DEBIT) and concessions (CREDIT) per fee head
      const paidByHead = new Map(); // feeHeadId -> number
      const concessionByHead = new Map(); // feeHeadId -> number
      const txnsByHead = new Map(); // feeHeadId -> DEBIT txns[] (only DEBITs can be source of transfer)
      for (const t of txns) {
        const hid = String(t.feeHead);
        const isCredit = t.transactionType === 'CREDIT';
        if (isCredit) {
          concessionByHead.set(hid, (concessionByHead.get(hid) || 0) + (Number(t.amount) || 0));
        } else {
          // DEBIT or default
          paidByHead.set(hid, (paidByHead.get(hid) || 0) + (Number(t.amount) || 0));
          if (!txnsByHead.has(hid)) txnsByHead.set(hid, []);
          txnsByHead.get(hid).push(t);
        }
      }

      // 3. Compare demand vs paid for each head (accounting for concessions)
      const allHeadIds = Array.from(new Set([
        ...demandByHead.keys(),
        ...paidByHead.keys(),
        ...concessionByHead.keys()
      ]));

      const overpaidHeads = []; // { headId, headName, demand, concession, effectiveDemand, paid, excess }
      const underpaidHeads = []; // { headId, headName, demand, concession, effectiveDemand, paid, due }

      for (const hid of allHeadIds) {
        const demandAmt = demandByHead.get(hid) || 0;
        const concessionAmt = concessionByHead.get(hid) || 0;
        const effectiveDemand = Math.max(0, demandAmt - concessionAmt);
        const paidAmt = paidByHead.get(hid) || 0;
        const headDoc = feeHeadMap.get(hid);
        const headName = headDoc ? headDoc.name : 'Unknown Head';

        if (paidAmt > effectiveDemand && demandAmt > 0) {
          overpaidHeads.push({
            headId: hid,
            headName,
            demand: demandAmt,
            concession: concessionAmt,
            effectiveDemand,
            paid: paidAmt,
            excess: paidAmt - effectiveDemand
          });
        } else if (paidAmt < effectiveDemand) {
          // Exclude late fee / penalty heads from being auto-reallocation targets
          if (/late\s*fee/i.test(headName) || /condonation/i.test(headName) || /fine/i.test(headName)) {
            continue;
          }
          underpaidHeads.push({
            headId: hid,
            headName,
            demand: demandAmt,
            concession: concessionAmt,
            effectiveDemand,
            paid: paidAmt,
            due: effectiveDemand - paidAmt
          });
        }
      }

      // 4. Plan transfers: PREFER EXACT MATCH FIRST
      if (overpaidHeads.length > 0 && underpaidHeads.length > 0) {
        studentsWithExcessCount++;

        const helperFindSourceTxn = (sourceTxns, neededAmt) => {
          // 1. Exact amount match (full transfer preferred)
          const exact = sourceTxns.find(t => Math.abs((Number(t.amount) || 0) - neededAmt) < 0.01);
          if (exact) return exact;
          // 2. Transaction with enough balance for partial transfer
          const enough = sourceTxns.find(t => (Number(t.amount) || 0) >= neededAmt);
          if (enough) return enough;
          // 3. Fallback to largest available transaction
          return [...sourceTxns].sort((a, b) => (Number(b.amount) || 0) - (Number(a.amount) || 0))[0];
        };

        // --- MATCHING: PRIORITIZE EXACT & CLOSEST SETTLEMENT MATCHES FIRST ---
        for (const over of overpaidHeads) {
          if (over.excess < 100) continue; // Skip if initial excess is trivial (< ₹100)
          const sourceTxns = txnsByHead.get(over.headId) || [];

          // Sort underpaid heads by best match quality:
          // 1. Exact match (difference = 0)
          // 2. Heads that can be fully settled (under.due <= over.excess), sorted by closest distance
          // 3. Other heads, sorted by closest distance
          const sortedUnderpaid = [...underpaidHeads]
            .filter(u => u.due > 0)
            .sort((a, b) => {
              const diffA = Math.abs(a.due - over.excess);
              const diffB = Math.abs(b.due - over.excess);
              const settlesA = a.due <= over.excess;
              const settlesB = b.due <= over.excess;

              if (diffA === 0 && diffB !== 0) return -1;
              if (diffB === 0 && diffA !== 0) return 1;

              if (settlesA && !settlesB) return -1;
              if (settlesB && !settlesA) return 1;

              return diffA - diffB;
            });

          for (const under of sortedUnderpaid) {
            // Stop if remaining excess is petty leftover (< ₹100) or underpaid head has 0 due
            if (over.excess < 100 || under.due <= 0) break;

            // The excess MUST be sufficient to settle the target head's due!
            // If excess is less than the due (e.g. ₹134 excess vs ₹400 SCH FEE), do NOT transfer!
            if (over.excess < under.due) {
              continue;
            }

            const transferAmt = under.due; // Settle the head completely

            const sourceTxn = helperFindSourceTxn(sourceTxns, transferAmt);
            if (!sourceTxn) continue;

            let matchType = '★ SETTLES';
            if (Math.abs(over.excess - under.due) < 0.01) {
              matchType = '★ EXACT';
            }

            plannedReallocations.push({
              student,
              admissionNo,
              studentYear,
              sourceHead: over,
              targetHead: under,
              sourceTxn,
              amount: transferAmt,
              matchType
            });

            over.excess -= transferAmt;
            under.due -= transferAmt;

            // Deduct from in-memory source transaction balance to prevent over-drawing
            sourceTxn.amount = Math.max(0, (Number(sourceTxn.amount) || 0) - transferAmt);
          }
        }
      }
    }

    // -------------------------------------------------------------
    // Display Summary of Detected Reallocations
    // -------------------------------------------------------------
    console.log(`\n===============================================================`);
    console.log(`DETECTION SUMMARY:`);
    console.log(`Total Students Checked: ${students.length}`);
    console.log(`Students with Excess Payments: ${studentsWithExcessCount}`);
    console.log(`Proposed Transfers: ${plannedReallocations.length}`);
    console.log(`===============================================================\n`);

    if (plannedReallocations.length === 0) {
      console.log('No excess payments detected across fee heads. All balances are consistent.');
      process.exit(0);
    }

    console.log('PROPOSED TRANSFERS TABLE (Exact Matches Prioritized):');
    console.table(plannedReallocations.map((p, idx) => {
      const fromHeadDesc = p.sourceHead.concession > 0
        ? `${p.sourceHead.headName} (Paid ${formatInr(p.sourceHead.paid)} / NetDem ${formatInr(p.sourceHead.effectiveDemand)} [Conc ${formatInr(p.sourceHead.concession)}])`
        : `${p.sourceHead.headName} (Paid ${formatInr(p.sourceHead.paid)} / Dem ${formatInr(p.sourceHead.demand)})`;

      const toHeadDesc = p.targetHead.concession > 0
        ? `${p.targetHead.headName} (Paid ${formatInr(p.targetHead.paid)} / NetDem ${formatInr(p.targetHead.effectiveDemand)} [Conc ${formatInr(p.targetHead.concession)}])`
        : `${p.targetHead.headName} (Paid ${formatInr(p.targetHead.paid)} / Dem ${formatInr(p.targetHead.demand)})`;

      return {
        '#': idx + 1,
        'Match': p.matchType,
        'Student': `${p.admissionNo} (${p.student.student_name})`,
        'From Head': fromHeadDesc,
        'To Head': toHeadDesc,
        'Transfer Amt': formatInr(p.amount),
        'Receipt #': p.sourceTxn.receiptNumber || 'N/A',
        'Txn Date': p.sourceTxn.paymentDate ? new Date(p.sourceTxn.paymentDate).toISOString().slice(0, 10) : 'N/A'
      };
    }));

    // -------------------------------------------------------------
    // Step 6: Confirmation & Execution
    // -------------------------------------------------------------
    console.log('\nOptions:');
    console.log('  [1] Dry Run (simulate without modifying database)');
    console.log('  [2] Execute Transfers (Commit changes to MongoDB)');
    console.log('  [Q] Quit / Cancel');

    const execAns = await askQuestion('\nChoose Option (1/2/Q): ');

    if (!/^2$/i.test(execAns.trim())) {
      console.log('\nExecution aborted or dry run completed. No database changes made.');
      process.exit(0);
    }

    const confirmAns = await askQuestion(`\n⚠️ Are you SURE you want to execute ${plannedReallocations.length} transfer(s)? Type YES to proceed: `);
    if (!/^yes$/i.test(confirmAns.trim()) && !/^y$/i.test(confirmAns.trim())) {
      console.log('Cancelled.');
      process.exit(0);
    }

    console.log('\nExecuting transfers...');
    let successCount = 0;
    let failCount = 0;
    const affectedStudents = new Set();

    for (const item of plannedReallocations) {
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        const sourceTxn = await Transaction.findById(item.sourceTxn._id).session(session);
        if (!sourceTxn) {
          throw new Error(`Source transaction ${item.sourceTxn._id} not found`);
        }

        const transferAmt = Number(item.amount);
        const isPartial = sourceTxn.amount > transferAmt;
        const remainingAmount = Math.round((sourceTxn.amount - transferAmt) * 100) / 100;

        // 1. Create Transaction B (Target)
        const transactionB = new Transaction({
          studentId: sourceTxn.studentId,
          studentName: sourceTxn.studentName,
          college: sourceTxn.college,
          collegeId: sourceTxn.collegeId,
          course: sourceTxn.course,
          courseId: sourceTxn.courseId,
          branch: sourceTxn.branch,
          branchId: sourceTxn.branchId,
          pinNo: sourceTxn.pinNo,
          admissionNumber: sourceTxn.admissionNumber,
          feeHead: item.targetHead.headId,
          amount: transferAmt,
          paymentDate: sourceTxn.paymentDate,
          transactionType: 'DEBIT',
          paymentMode: sourceTxn.paymentMode || 'Cash',
          bankName: sourceTxn.bankName,
          instrumentDate: sourceTxn.instrumentDate,
          referenceNo: sourceTxn.referenceNo,
          referenceDate: sourceTxn.referenceDate,
          paymentConfigId: sourceTxn.paymentConfigId,
          depositedToAccount: sourceTxn.depositedToAccount,
          status: 'active',
          semester: sourceTxn.semester || 'All',
          studentYear: item.studentYear,
          receiptNumber: sourceTxn.receiptNumber,
          collectedBy: 'SCRIPT_AUTO_REALLOCATE',
          collectedByName: 'Auto Reallocation Script',
          remarks: `Auto-Transfer from ${item.sourceHead.headName} (Excess reallocated to ${item.targetHead.headName})`,
          transferredFromTransactionId: sourceTxn._id
        });

        if (sourceTxn.createdAt) {
          transactionB.set('createdAt', sourceTxn.createdAt);
        }

        await transactionB.save({ session });

        // 2. Update Source Transaction
        const transferNote = `[Transferred ₹${transferAmt} to ${item.targetHead.headName}]`;
        if (isPartial) {
          sourceTxn.amount = remainingAmount;
          sourceTxn.transferredToFeeHead = item.targetHead.headId;
          sourceTxn.transferredToTransactionId = transactionB._id;
          sourceTxn.transferredBy = 'SCRIPT_AUTO_REALLOCATE';
          sourceTxn.transferredByName = 'Auto Reallocation Script';
          sourceTxn.transferredAt = new Date();
          sourceTxn.transferRemarks = `Partially transferred ₹${transferAmt} to ${item.targetHead.headName}. Remaining ₹${remainingAmount}`;
          sourceTxn.remarks = sourceTxn.remarks ? `${sourceTxn.remarks} ${transferNote}` : transferNote;
          await sourceTxn.save({ session });
        } else {
          sourceTxn.status = 'transferred';
          sourceTxn.transferredToFeeHead = item.targetHead.headId;
          sourceTxn.transferredToTransactionId = transactionB._id;
          sourceTxn.transferredBy = 'SCRIPT_AUTO_REALLOCATE';
          sourceTxn.transferredByName = 'Auto Reallocation Script';
          sourceTxn.transferredAt = new Date();
          sourceTxn.transferRemarks = `Fully transferred ₹${transferAmt} to ${item.targetHead.headName}`;
          await sourceTxn.save({ session });
        }

        await session.commitTransaction();
        session.endSession();

        successCount++;
        affectedStudents.add(item.admissionNo);
        console.log(`✓ [${item.admissionNo}] Transferred ${formatInr(transferAmt)} from ${item.sourceHead.headName} -> ${item.targetHead.headName} (Receipt: ${sourceTxn.receiptNumber})`);
      } catch (err) {
        await session.abortTransaction();
        session.endSession();
        failCount++;
        console.error(`✗ Error transferring for ${item.admissionNo}:`, err.message);
      }
    }

    // -------------------------------------------------------------
    // Trigger Late Fee Sync for All Students in Selected Batch
    // (Reconciles late fees against updated transactions without running transport sync)
    // -------------------------------------------------------------
    console.log(`\n--- TRIGGERING LATE FEE RECONCILIATION FOR ${students.length} STUDENT(S) IN BATCH ---`);
    let totalLateFeesEvaluated = 0;
    let totalLateFeesRemoved = 0;

    const CHUNK_SIZE = 25;
    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const chunk = students.slice(i, i + CHUNK_SIZE);
      await Promise.all(chunk.map(async (st) => {
        try {
          const res = await syncLateFees(st, st.admission_number);
          if (res && res.evaluated > 0) {
            totalLateFeesEvaluated += res.evaluated;
            totalLateFeesRemoved += res.removed;
            if (res.removed > 0) {
              console.log(`✓ [${st.admission_number}] Removed ${res.removed} obsolete late fee(s)`);
            }
          }
        } catch (syncErr) {
          console.error(`✗ Late fee sync error for ${st.admission_number}:`, syncErr.message);
        }
      }));
    }

    console.log('\n===============================================================');
    console.log(`TRANSFER EXECUTION COMPLETED!`);
    console.log(`Success: ${successCount}`);
    console.log(`Failed:  ${failCount}`);
    console.log(`Batch Students Checked: ${students.length}`);
    console.log(`Late Fees Evaluated: ${totalLateFeesEvaluated}`);
    console.log(`Obsolete Late Fees Removed: ${totalLateFeesRemoved}`);
    console.log('===============================================================\n');

  } catch (err) {
    console.error('Fatal Script Error:', err);
  } finally {
    rl.close();
    await mongoose.disconnect();
    console.log('MongoDB disconnected.');
    process.exit(0);
  }
}

main();

const db = require('../config/sqlDb');
const Setting = require('../models/Setting');
const FeeGroup = require('../models/FeeGroup');
const ReceiptSequence = require('../models/ReceiptSequence');

/**
 * Calculate the current financial year based on setting reset month and day.
 * Example: Date in October 2026 with April 1 reset returns "2026-27".
 * Example: Date in February 2026 with April 1 reset returns "2025-26".
 */
const calculateFinancialYear = (date = new Date(), resetMonth = 4, resetDay = 1) => {
  const currentYear = date.getFullYear();
  const resetDateThisYear = new Date(currentYear, resetMonth - 1, resetDay);
  if (date >= resetDateThisYear) {
    const nextYearLastTwoDigits = String(currentYear + 1).slice(-2);
    return `${currentYear}-${nextYearLastTwoDigits}`;
  } else {
    const currentYearLastTwoDigits = String(currentYear).slice(-2);
    return `${currentYear - 1}-${currentYearLastTwoDigits}`;
  }
};

/**
 * Resolve student's college code and course code from SQL database.
 */
const resolveStudentCollegeAndCourse = async (studentId) => {
  let collegeCode = 'GEN';
  let courseCode = 'GEN';

  if (!studentId) {
    return { collegeCode, courseCode };
  }

  try {
    const [studentRows] = await db.query(
      'SELECT college, course FROM students WHERE admission_number = ?',
      [studentId]
    );

    if (studentRows && studentRows.length > 0) {
      const studentCollege = studentRows[0].college;
      const studentCourse = studentRows[0].course;

      if (studentCollege) {
        const [collegeRows] = await db.query(
          'SELECT id, code FROM colleges WHERE name = ?',
          [studentCollege]
        );
        let collegeId = null;
        if (collegeRows && collegeRows.length > 0) {
          collegeCode = (collegeRows[0].code || 'GEN').toUpperCase().trim();
          collegeId = collegeRows[0].id;
        } else {
          collegeCode = studentCollege.toUpperCase().trim();
        }

        if (studentCourse) {
          let courseRows = [];
          if (collegeId) {
            [courseRows] = await db.query(
              'SELECT code FROM courses WHERE name = ? AND college_id = ?',
              [studentCourse, collegeId]
            );
          }
          if (courseRows.length === 0) {
            [courseRows] = await db.query(
              'SELECT code FROM courses WHERE name = ?',
              [studentCourse]
            );
          }
          if (courseRows && courseRows.length > 0 && courseRows[0].code) {
            courseCode = courseRows[0].code.toUpperCase().trim();
          } else {
            courseCode = studentCourse.toUpperCase().trim();
          }
        }
      } else if (studentCourse) {
        const [courseRows] = await db.query(
          'SELECT code FROM courses WHERE name = ?',
          [studentCourse]
        );
        if (courseRows && courseRows.length > 0 && courseRows[0].code) {
          courseCode = courseRows[0].code.toUpperCase().trim();
        } else {
          courseCode = studentCourse.toUpperCase().trim();
        }
      }
    }
  } catch (err) {
    console.error('Error resolving student college and course codes:', err);
  }

  return { collegeCode, courseCode };
};

/**
 * Resolve group code from feeHeadId.
 */
const resolveGroupCode = async (feeHeadId) => {
  if (!feeHeadId) return 'GEN';
  try {
    const feeGroup = await FeeGroup.findOne({ feeHeads: feeHeadId });
    if (feeGroup && feeGroup.code) {
      return feeGroup.code.toUpperCase().trim();
    }
  } catch (err) {
    console.error('Error resolving fee group code:', err);
  }
  return 'GEN';
};

/**
 * Generate or preview the next receipt number according to settings.
 *
 * @param {Object} options
 * @param {string} [options.studentId] - Student admission number
 * @param {string} [options.collegeCode] - Direct college code override
 * @param {string} [options.courseCode] - Direct course code override
 * @param {string} [options.feeHeadId] - Fee head ID
 * @param {string} [options.groupCode] - Direct fee group code override
 * @param {Date} [options.date] - Date for financial year calculation (default: now)
 * @param {boolean} [options.allocate=true] - If true, increments database counter. If false, preview only.
 */
const generateReceiptNumber = async (options = {}) => {
  const {
    studentId,
    feeHeadId,
    date = new Date(),
    allocate = true
  } = options;

  // 1. Fetch sequence settings
  const setting = await Setting.findOne();
  const enableCustom = setting ? setting.enableCustomReceiptSequence : false;
  const separator = setting ? setting.receiptSequenceSeparator || '/' : '/';
  const padding = setting ? (setting.receiptSequencePadding !== undefined ? setting.receiptSequencePadding : 5) : 5;
  const resetMonth = setting ? (setting.receiptSequenceResetMonth || 4) : 4;
  const resetDay = setting ? (setting.receiptSequenceResetDay || 1) : 1;

  // 2. If custom sequence is disabled, use default timestamp-based format
  if (!enableCustom) {
    if (allocate) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(100 + Math.random() * 900).toString();
      const receiptNumber = `REC${timestamp}${random}`;
      return {
        receiptNumber,
        isCustomSequence: false,
        allocated: true,
        details: { format: 'REC<timestamp><random>' }
      };
    } else {
      return {
        receiptNumber: 'RECxxxxxxxxx',
        isCustomSequence: false,
        allocated: false,
        details: { format: 'REC<timestamp><random>' }
      };
    }
  }

  // 3. Resolve college and course codes
  let collegeCode = options.collegeCode ? options.collegeCode.toUpperCase().trim() : null;
  let courseCode = options.courseCode ? options.courseCode.toUpperCase().trim() : null;

  if (!collegeCode || !courseCode) {
    const resolved = await resolveStudentCollegeAndCourse(studentId);
    if (!collegeCode) collegeCode = resolved.collegeCode;
    if (!courseCode) courseCode = resolved.courseCode;
  }

  // 4. Resolve group code
  let groupCode = options.groupCode ? options.groupCode.toUpperCase().trim() : null;
  if (!groupCode) {
    groupCode = await resolveGroupCode(feeHeadId);
  }

  // 5. Calculate Financial Year
  const referenceDate = date instanceof Date ? date : new Date(date);
  const financialYear = calculateFinancialYear(referenceDate, resetMonth, resetDay);

  // 6. Get or allocate sequence number
  let sequenceNumber = 1;

  if (allocate) {
    let seq;
    try {
      seq = await ReceiptSequence.findOneAndUpdate(
        { collegeCode, courseCode, groupCode, financialYear },
        { $inc: { nextNumber: 1 } },
        { new: true, upsert: true }
      );
    } catch (err) {
      if (err.code === 11000) {
        // Document was created by concurrent request — just increment it
        seq = await ReceiptSequence.findOneAndUpdate(
          { collegeCode, courseCode, groupCode, financialYear },
          { $inc: { nextNumber: 1 } },
          { new: true }
        );
      } else {
        throw err;
      }
    }
    sequenceNumber = seq ? seq.nextNumber : 1;
  } else {
    // Preview mode: check current value without incrementing
    const seq = await ReceiptSequence.findOne({ collegeCode, courseCode, groupCode, financialYear });
    sequenceNumber = seq ? seq.nextNumber + 1 : 1;
  }

  // 7. Format receipt string
  const paddedNum = String(sequenceNumber).padStart(padding, '0');
  const receiptNumber = `${collegeCode}${separator}${courseCode}${separator}${groupCode}${separator}${paddedNum}`;

  return {
    receiptNumber,
    sequenceNumber,
    isCustomSequence: true,
    allocated: !!allocate,
    details: {
      collegeCode,
      courseCode,
      groupCode,
      financialYear,
      padding,
      separator
    }
  };
};

module.exports = {
  calculateFinancialYear,
  resolveStudentCollegeAndCourse,
  resolveGroupCode,
  generateReceiptNumber
};


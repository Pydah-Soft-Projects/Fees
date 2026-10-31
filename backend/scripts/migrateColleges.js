require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

const CANONICAL_MAP = {
  'pydahpolytechnicofagriculturepatavala': 'Pydah Polytechnic of Agriculture, Patavala',
  'pydahpolytechnicofagriculturedraksharama': 'Pydah Polytechnic of Agriculture, Draksharama',
};

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const migrate = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB. Scanning users...');

  const users = await User.find({
    $or: [
      { colleges: { $exists: true, $ne: [] } },
      { college: { $exists: true, $ne: '' } },
      { courses: { $exists: true, $ne: [] } }
    ]
  });

  console.log(`Checking ${users.length} users with college/courses...`);
  let updatedCount = 0;

  for (const u of users) {
    let changed = false;

    // 1. Fix single college
    if (u.college) {
      const norm = normalize(u.college);
      if (CANONICAL_MAP[norm] && u.college !== CANONICAL_MAP[norm]) {
        console.log(`[${u.username}] Fixing college: "${u.college}" -> "${CANONICAL_MAP[norm]}"`);
        u.college = CANONICAL_MAP[norm];
        changed = true;
      }
    }

    // 2. Fix colleges array
    if (u.colleges && u.colleges.length > 0) {
      const fixedColleges = u.colleges.map((col) => {
        const norm = normalize(col);
        return CANONICAL_MAP[norm] || col;
      });
      // Deduplicate
      const uniqueColleges = Array.from(new Set(fixedColleges));
      if (JSON.stringify(uniqueColleges) !== JSON.stringify(u.colleges)) {
        console.log(`[${u.username}] Fixing colleges:`, u.colleges, '->', uniqueColleges);
        u.colleges = uniqueColleges;
        changed = true;
      }
    }

    // 3. Fix courses array
    if (u.courses && u.courses.length > 0) {
      const fixedCourses = new Set();
      u.courses.forEach((c) => {
        if (!c.includes('|')) {
          fixedCourses.add(c);
          return;
        }
        const [col, coursePart] = c.split('|');
        const normCol = normalize(col);
        const canonCol = CANONICAL_MAP[normCol] || col;

        // Add original with fixed college name
        fixedCourses.add(`${canonCol}|${coursePart}`);

        // Also add canonical course names if branch codes or variants are used
        const normCourse = normalize(coursePart);
        if (normCourse === 'dapptv' || normCourse === 'dap') {
          fixedCourses.add(`${canonCol}|Diploma In Agriculture`);
          fixedCourses.add(`${canonCol}|DAP-PTV`);
        }
        if (normCourse === 'daekkd') {
          fixedCourses.add(`${canonCol}|Diploma in Agricultural Engineering`);
          fixedCourses.add(`${canonCol}|DAE-KKD`);
        }
        if (normCourse === 'diplomainfisheries' || normCourse === 'diplomainfisheriespolytechnic') {
          fixedCourses.add(`${canonCol}|Diploma in Fisheries`);
          fixedCourses.add(`${canonCol}|Diploma in Fisheries Polytechnic`);
        }
      });

      const uniqueCourses = Array.from(fixedCourses);
      if (JSON.stringify(uniqueCourses.sort()) !== JSON.stringify(u.courses.slice().sort())) {
        console.log(`[${u.username}] Fixing courses for user`);
        u.courses = uniqueCourses;
        changed = true;
      }
    }

    if (changed) {
      await u.save();
      updatedCount++;
    }
  }

  console.log(`Migration complete. Successfully updated ${updatedCount} users.`);
  process.exit(0);
};

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});


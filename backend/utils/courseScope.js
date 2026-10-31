const db = require('../config/sqlDb');

const normalizeString = (str) =>
    String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

let canonicalCoursesCache = null;
let canonicalCoursesCacheTime = 0;

/**
 * Dynamically loads all active courses from MySQL `courses` table joined with `colleges`,
 * plus any distinct `students.course` text variants mapped to `course_id`.
 * Result is cached in memory for 60 seconds.
 */
const getCanonicalCourses = async (forceRefresh = false) => {
    const now = Date.now();
    if (!forceRefresh && canonicalCoursesCache && (now - canonicalCoursesCacheTime < 60000)) {
        return canonicalCoursesCache;
    }

    try {
        const [courseRows] = await db.query(`
            SELECT 
                c.id, 
                c.college_id, 
                c.name, 
                c.code, 
                c.total_years,
                cl.name as college_name,
                cl.code as college_code
            FROM courses c
            JOIN colleges cl ON c.college_id = cl.id
            WHERE c.is_active = 1 AND cl.is_active = 1
            ORDER BY cl.name, c.name
        `);

        // Also dynamically fetch distinct student course names per course_id
        let studentCourseRows = [];
        try {
            const [scRows] = await db.query(`
                SELECT DISTINCT course_id, course 
                FROM students 
                WHERE course_id IS NOT NULL AND course IS NOT NULL AND course != ''
            `);
            studentCourseRows = scRows || [];
        } catch (e) {
            console.warn('[courseScope] Could not fetch distinct student course names:', e.message);
        }

        const studentVariantsByCourseId = new Map();
        studentCourseRows.forEach((row) => {
            const cid = Number(row.course_id);
            if (!studentVariantsByCourseId.has(cid)) {
                studentVariantsByCourseId.set(cid, new Set());
            }
            if (row.course) {
                studentVariantsByCourseId.get(cid).add(row.course.trim());
            }
        });

        const list = (courseRows || []).map((c) => {
            const cid = Number(c.id);
            const variantSet = new Set();
            if (c.name) variantSet.add(c.name.trim());
            const studentVariants = studentVariantsByCourseId.get(cid);
            if (studentVariants) {
                studentVariants.forEach((v) => variantSet.add(v));
            }
            return {
                id: cid,
                college_id: Number(c.college_id),
                name: c.name,
                code: c.code,
                total_years: c.total_years,
                college_name: c.college_name,
                college_code: c.college_code,
                allNames: Array.from(variantSet)
            };
        });

        canonicalCoursesCache = list;
        canonicalCoursesCacheTime = now;
        return list;
    } catch (error) {
        console.error('[courseScope] Error loading canonical courses:', error);
        return canonicalCoursesCache || [];
    }
};

/**
 * Finds matching course records given an identifier (number ID, string name, code, or 'College|Course').
 */
const findMatchingCourses = async (identifier, optionalCollegeId = null) => {
    if (!identifier && identifier !== 0) return [];
    const allCourses = await getCanonicalCourses();
    const str = String(identifier).trim();
    if (!str) return [];

    // 1. Direct numeric ID match
    if (/^\d+$/.test(str)) {
        const numId = Number(str);
        const match = allCourses.find((c) => c.id === numId);
        return match ? [match] : [];
    }

    // 2. Pipe-separated 'College|Course' match
    if (str.includes('|')) {
        const [collegePart, coursePart] = str.split('|').map((s) => s.trim());
        const normCollege = normalizeString(collegePart);
        const normCourse = normalizeString(coursePart);
        return allCourses.filter((c) => {
            const matchCollege = normalizeString(c.college_name) === normCollege || normalizeString(c.college_code) === normCollege;
            const matchCourse = normalizeString(c.name) === normCourse || normalizeString(c.code) === normCourse || c.allNames.some((n) => normalizeString(n) === normCourse);
            return matchCollege && matchCourse;
        });
    }

    // 3. Match by course name, code, or known student variant
    const norm = normalizeString(str);
    let matched = allCourses.filter((c) => {
        if (optionalCollegeId && Number(c.college_id) !== Number(optionalCollegeId)) {
            return false;
        }
        if (normalizeString(c.name) === norm || normalizeString(c.code) === norm) {
            return true;
        }
        return c.allNames.some((n) => normalizeString(n) === norm);
    });

    // If scoped by optionalCollegeId produced no result, try matching across all colleges
    if (matched.length === 0 && optionalCollegeId) {
        matched = allCourses.filter((c) => {
            if (normalizeString(c.name) === norm || normalizeString(c.code) === norm) {
                return true;
            }
            return c.allNames.some((n) => normalizeString(n) === norm);
        });
    }

    return matched;
};

/**
 * Resolves user's assigned courses into a Set of permitted numeric course IDs.
 * Returns null if user has no course restrictions (unscoped).
 */
const resolveAllowedCourseIds = async (user) => {
    if (!user) return null;
    const rawCourses = user.courses || [];
    if (!Array.isArray(rawCourses) || rawCourses.length === 0) {
        return null;
    }

    const allCourses = await getCanonicalCourses();
    const allowedIds = new Set();

    for (const item of rawCourses) {
        const matched = await findMatchingCourses(item);
        matched.forEach((c) => allowedIds.add(c.id));
    }

    // If user has rawCourses listed but none matched DB, fallback to empty set (forbidden)
    return allowedIds;
};

/**
 * Resolves dynamic course scope for student queries.
 *
 * @param {Object} options
 * @param {Object} options.user - req.user
 * @param {string|number} [options.course] - requested course name, code, or ID
 * @param {string|number} [options.courseId] - requested course ID
 * @param {number[]} [options.collegeIds] - optional college IDs to restrict courses to
 * @returns {Promise<{ allowed: boolean, courseIds: number[], courseNames: string[] }>}
 */
const resolveCourseScope = async ({ user, course, courseId, collegeIds = null } = {}) => {
    const allCourses = await getCanonicalCourses();
    const allowedIds = await resolveAllowedCourseIds(user);

    const targetCourse = courseId || course;

    // A specific course was requested
    if (targetCourse) {
        const matched = await findMatchingCourses(targetCourse, collegeIds?.length === 1 ? collegeIds[0] : null);
        if (matched.length === 0) {
            return { allowed: false, courseIds: [], courseNames: [] };
        }

        // Filter matched by allowedIds if restricted
        const validCourses = allowedIds === null
            ? matched
            : matched.filter((c) => allowedIds.has(c.id));

        if (validCourses.length === 0) {
            return { allowed: false, courseIds: [], courseNames: [] };
        }

        const courseIds = validCourses.map((c) => c.id);
        const nameSet = new Set();
        validCourses.forEach((c) => {
            c.allNames.forEach((n) => nameSet.add(n));
        });

        return {
            allowed: true,
            courseIds,
            courseNames: Array.from(nameSet)
        };
    }

    // No specific course requested, but user has assigned courses
    if (allowedIds !== null) {
        let scopedCourses = allCourses.filter((c) => allowedIds.has(c.id));
        if (collegeIds && collegeIds.length > 0) {
            scopedCourses = scopedCourses.filter((c) => collegeIds.includes(c.college_id));
        }

        if (scopedCourses.length === 0) {
            return { allowed: false, courseIds: [], courseNames: [] };
        }

        const courseIds = scopedCourses.map((c) => c.id);
        const nameSet = new Set();
        scopedCourses.forEach((c) => {
            c.allNames.forEach((n) => nameSet.add(n));
        });

        return {
            allowed: true,
            courseIds,
            courseNames: Array.from(nameSet)
        };
    }

    // Unrestricted
    return {
        allowed: true,
        courseIds: [],
        courseNames: []
    };
};

/**
 * Checks if a course name or ID is permitted for the given user.
 */
const isCoursePermitted = async (courseNameOrId, user) => {
    if (!user) return true;
    const allowedIds = await resolveAllowedCourseIds(user);
    if (allowedIds === null) return true; // Unrestricted

    const matched = await findMatchingCourses(courseNameOrId);
    if (matched.length === 0) return false;
    return matched.some((c) => allowedIds.has(c.id));
};

module.exports = {
    getCanonicalCourses,
    findMatchingCourses,
    resolveAllowedCourseIds,
    resolveCourseScope,
    isCoursePermitted,
    normalizeString
};


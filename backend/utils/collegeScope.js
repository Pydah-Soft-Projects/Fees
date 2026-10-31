const db = require('../config/sqlDb');
const campusService = require('../services/campusService');

const isUnscopedAdmin = (user) =>
    user?.role === 'superadmin' || user?.role === 'admin';

const normalizeCampusIds = (campusIds = []) =>
    (campusIds || [])
        .map((id) => Number(id))
        .filter((id) => !Number.isNaN(id) && id > 0);

const normalizeCollegeString = (str) =>
    String(str || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

let canonicalCollegesCache = null;
let canonicalCollegesCacheTime = 0;

const getCanonicalColleges = async () => {
    const now = Date.now();
    if (canonicalCollegesCache && (now - canonicalCollegesCacheTime < 60000)) {
        return canonicalCollegesCache;
    }
    try {
        const [rows] = await db.query('SELECT id, name, code FROM colleges WHERE is_active = 1');
        canonicalCollegesCache = rows || [];
        canonicalCollegesCacheTime = now;
        return canonicalCollegesCache;
    } catch {
        return canonicalCollegesCache || [];
    }
};

/**
 * Maps raw college strings (e.g. without commas, differing case or whitespace)
 * to their exact canonical name defined in the MySQL colleges table.
 */
const resolveCanonicalCollegeNames = async (collegeNames = []) => {
    if (!collegeNames || collegeNames.length === 0) return [];
    const canonicalList = await getCanonicalColleges();
    const resolved = new Set();

    collegeNames.forEach((raw) => {
        const trimmed = String(raw || '').trim();
        if (!trimmed) return;
        const norm = normalizeCollegeString(trimmed);
        const match = canonicalList.find((c) => normalizeCollegeString(c.name) === norm);
        if (match) {
            resolved.add(match.name);
        } else {
            resolved.add(trimmed);
        }
    });

    return Array.from(resolved);
};

/**
 * Safely parses a college query parameter which may be a comma-separated string,
 * delimiter-separated string, or array. Protects against college names that contain
 * commas (e.g. "Pydah Polytechnic of Agriculture, Patavala") getting split in half.
 */
const parseCollegeParam = async (collegeParam) => {
    if (!collegeParam) return [];
    if (Array.isArray(collegeParam)) {
        return resolveCanonicalCollegeNames(collegeParam);
    }

    const rawStr = String(collegeParam).trim();
    if (!rawStr) return [];

    const canonicalList = await getCanonicalColleges();
    const foundColleges = new Set();

    // 1. Check if any canonical college name (especially ones with commas) is contained in the string
    const normInput = normalizeCollegeString(rawStr);
    canonicalList.forEach((c) => {
        const normC = normalizeCollegeString(c.name);
        if (normInput.includes(normC)) {
            foundColleges.add(c.name);
        }
    });

    // 2. If nothing matched from canonical list, fallback to split by delimiter
    if (foundColleges.size === 0) {
        const delimiter = rawStr.includes('||') ? '||' : ',';
        const parts = rawStr.split(delimiter).map((p) => p.trim()).filter(Boolean);
        return resolveCanonicalCollegeNames(parts);
    }

    return Array.from(foundColleges);
};

/**
 * Resolve college names the current request should be limited to.
 * Returns null = no restriction (all colleges).
 * Returns [] = no access.
 */
const getEffectiveCollegeNames = async (user, campusIdParam) => {
    const userColleges = await getUserCollegeNames(user);

    if (campusIdParam && campusIdParam !== 'all' && campusIdParam !== '') {
        const campusColleges = await campusService.getCollegeNamesByCampusId(Number(campusIdParam));
        const canonicalCampusColleges = await resolveCanonicalCollegeNames(campusColleges);
        if (userColleges === null) return canonicalCampusColleges;
        if (userColleges.length === 0) return [];
        return intersectCollegeNames(canonicalCampusColleges, userColleges);
    }

    return userColleges;
};

const getUserCollegeNames = async (user) => {
    if (!user) return null;

    const campusIds = normalizeCampusIds(user.campuses);
    let fromCampuses = [];
    if (campusIds.length > 0) {
        fromCampuses = await campusService.getCollegesForCampusIds(campusIds);
    }
    fromCampuses = await resolveCanonicalCollegeNames(fromCampuses);

    const rawExplicit = user.colleges?.length > 0
        ? user.colleges
        : (user.college ? [user.college] : []);
    const explicitColleges = await resolveCanonicalCollegeNames(rawExplicit);

    if (fromCampuses.length > 0 && explicitColleges.length > 0) {
        const explicitNorms = new Set(explicitColleges.map(normalizeCollegeString));
        const scoped = fromCampuses.filter((c) => explicitNorms.has(normalizeCollegeString(c)));
        return scoped.length > 0 ? scoped : explicitColleges;
    }
    if (fromCampuses.length > 0) return fromCampuses;
    if (explicitColleges.length > 0) return explicitColleges;

    // Superadmin/admin with no campus/college assignment → all colleges
    if (isUnscopedAdmin(user) && campusIds.length === 0 && explicitColleges.length === 0) {
        return null;
    }

    return null;
};

const getStudentIdentifiersByColleges = async (collegeNames) => {
    if (!collegeNames || collegeNames.length === 0) return [];
    const canonicalNames = await resolveCanonicalCollegeNames(collegeNames);
    const [rows] = await db.query(
        `SELECT admission_number, pin_no FROM students WHERE TRIM(college) IN (${canonicalNames.map(() => '?').join(',')})`,
        canonicalNames.map((c) => c.trim())
    );
    const ids = new Set();
    rows.forEach((r) => {
        if (r.admission_number) ids.add(String(r.admission_number).trim());
        if (r.pin_no) ids.add(String(r.pin_no).trim());
    });
    return Array.from(ids);
};

const getStudentAdmissionNumbersByColleges = getStudentIdentifiersByColleges;

const applyStudentIdFilter = async (user, campusIdParam, existingQuery = {}) => {
    const collegeNames = await getEffectiveCollegeNames(user, campusIdParam);
    if (collegeNames === null) return existingQuery;

    const studentIds = await getStudentIdentifiersByColleges(collegeNames);
    if (studentIds.length === 0) {
        return { ...existingQuery, studentId: { $in: ['__none__'] } };
    }
    return { ...existingQuery, studentId: { $in: studentIds } };
};

const applyCollegeFilter = async (user, campusIdParam, existingQuery = {}) => {
    const collegeNames = await getEffectiveCollegeNames(user, campusIdParam);
    if (collegeNames === null) return existingQuery;
    return { ...existingQuery, college: { $in: collegeNames } };
};

const filterHierarchyByColleges = (hierarchy, collegeNames) => {
    if (!collegeNames || collegeNames.length === 0) return hierarchy;
    const allowedNormMap = new Map();
    collegeNames.forEach((n) => allowedNormMap.set(normalizeCollegeString(n), n));

    const filtered = {};
    Object.keys(hierarchy || {}).forEach((colName) => {
        const norm = normalizeCollegeString(colName);
        if (allowedNormMap.has(norm)) {
            filtered[colName] = hierarchy[colName];
        }
    });
    return filtered;
};

const filterCollegeCodes = (collegeCodes, collegeNames) => {
    if (!collegeNames || collegeNames.length === 0) return collegeCodes;
    const allowedNormMap = new Map();
    collegeNames.forEach((n) => allowedNormMap.set(normalizeCollegeString(n), n));

    const filtered = {};
    Object.keys(collegeCodes || {}).forEach((colName) => {
        const norm = normalizeCollegeString(colName);
        if (allowedNormMap.has(norm)) {
            filtered[colName] = collegeCodes[colName];
        }
    });
    return filtered;
};

const buildCollegeSqlFilter = (collegeNames, column = 'college') => {
    if (!collegeNames || collegeNames.length === 0) {
        return { clause: '', params: [] };
    }
    return {
        clause: ` AND TRIM(${column}) IN (${collegeNames.map(() => '?').join(',')})`,
        params: collegeNames.map((c) => c.trim()),
    };
};

const intersectCollegeNames = (requestedColleges, allowedColleges) => {
    if (!allowedColleges) return requestedColleges;
    if (!requestedColleges || requestedColleges.length === 0) return allowedColleges;

    const allowedNormMap = new Map();
    allowedColleges.forEach((c) => allowedNormMap.set(normalizeCollegeString(c), c));

    const result = new Set();
    requestedColleges.forEach((req) => {
        const norm = normalizeCollegeString(req);
        if (allowedNormMap.has(norm)) {
            result.add(allowedNormMap.get(norm));
        }
    });
    return Array.from(result);
};

const isCollegeAllowed = (collegeName, allowedColleges) => {
    if (!allowedColleges || allowedColleges.length === 0) return true;
    if (!collegeName) return false;
    const targetNorm = normalizeCollegeString(collegeName);
    return allowedColleges.some((c) => normalizeCollegeString(c) === targetNorm);
};

/**
 * Resolves dynamic college scope including numeric college IDs and canonical names.
 *
 * @param {Object} options
 * @param {Object} options.user - req.user
 * @param {string|number} [options.college] - requested college name, array, or string
 * @param {string|number} [options.collegeId] - requested college ID
 * @param {string|number} [options.campusId] - optional campus filter
 * @returns {Promise<{ allowed: boolean, collegeIds: number[], collegeNames: string[] }>}
 */
const resolveCollegeScope = async ({ user, college, collegeId, campusId } = {}) => {
    const canonicalList = await getCanonicalColleges();
    const effectiveAllowedNames = await getEffectiveCollegeNames(user, campusId);

    // Target college requested either via collegeId or college name
    let requestedNames = [];
    if (collegeId) {
        const idParts = String(collegeId).split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n) && n > 0);
        const matched = canonicalList.filter((c) => idParts.includes(Number(c.id)));
        requestedNames = matched.map((c) => c.name);
    } else if (college) {
        requestedNames = await parseCollegeParam(college);
    }

    if (requestedNames.length > 0) {
        const scopedNames = intersectCollegeNames(requestedNames, effectiveAllowedNames);
        if (scopedNames.length === 0) {
            return { allowed: false, collegeIds: [], collegeNames: [] };
        }
        const matchedColleges = canonicalList.filter((c) =>
            scopedNames.some((sn) => normalizeCollegeString(c.name) === normalizeCollegeString(sn))
        );
        return {
            allowed: true,
            collegeIds: matchedColleges.map((c) => Number(c.id)),
            collegeNames: scopedNames
        };
    }

    // No specific college requested, but user has allowed colleges
    if (effectiveAllowedNames && effectiveAllowedNames.length > 0) {
        const matchedColleges = canonicalList.filter((c) =>
            effectiveAllowedNames.some((an) => normalizeCollegeString(c.name) === normalizeCollegeString(an))
        );
        return {
            allowed: true,
            collegeIds: matchedColleges.map((c) => Number(c.id)),
            collegeNames: effectiveAllowedNames
        };
    }

    // Unrestricted (e.g. superadmin)
    return {
        allowed: true,
        collegeIds: [],
        collegeNames: []
    };
};

module.exports = {
    getCanonicalColleges,
    getEffectiveCollegeNames,
    getUserCollegeNames,
    getStudentIdentifiersByColleges,
    getStudentAdmissionNumbersByColleges,
    applyStudentIdFilter,
    applyCollegeFilter,
    filterHierarchyByColleges,
    filterCollegeCodes,
    buildCollegeSqlFilter,
    intersectCollegeNames,
    isCollegeAllowed,
    normalizeCampusIds,
    isUnscopedAdmin,
    normalizeCollegeString,
    resolveCanonicalCollegeNames,
    parseCollegeParam,
    resolveCollegeScope
};

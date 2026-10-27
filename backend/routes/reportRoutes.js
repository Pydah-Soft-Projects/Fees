const express = require('express');
const router = express.Router();
const { getTransactionReports, getDueReports, getCollegeDuesSummary, getDashboardStats } = require('../controllers/reportsController');

router.get('/transactions', getTransactionReports);
router.get('/dues', getDueReports);
router.get('/college-dues-summary', getCollegeDuesSummary);
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;

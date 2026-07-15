const express = require('express');
const router = express.Router();
const { authStudent, authAdmin, requireRole } = require('../middleware/auth');

const studentAuth = require('../controllers/studentAuth');
const adminAuth   = require('../controllers/adminAuth');
const election    = require('../controllers/election');
const voting      = require('../controllers/voting');
const student     = require('../controllers/student');
const candidate   = require('../controllers/candidate');
const dashboard   = require('../controllers/dashboard');

// ── STUDENT AUTH ──────────────────────────────────────────
router.post('/student/register',         studentAuth.register);
router.post('/student/login',            studentAuth.login);
router.get ('/student/profile',          authStudent, studentAuth.getProfile);
router.put ('/student/profile',          authStudent, studentAuth.updateProfile);
router.post('/student/documents',        authStudent, studentAuth.uploadDocuments);
router.put ('/student/change-password',  authStudent, studentAuth.changePassword);

// ── ADMIN AUTH ────────────────────────────────────────────
router.post('/admin/login',              adminAuth.login);
router.get ('/admin/profile',            authAdmin, adminAuth.getProfile);
router.put ('/admin/change-password',    authAdmin, adminAuth.changePassword);
router.get ('/admin/admins',             authAdmin, requireRole('super_admin'), adminAuth.getAdmins);
router.post('/admin/admins',             authAdmin, requireRole('super_admin'), adminAuth.createAdmin);

// ── ELECTIONS (ADMIN) ─────────────────────────────────────
router.get ('/admin/elections',                    authAdmin, election.getAllElections);
router.post('/admin/elections',                    authAdmin, election.createElection);
router.get ('/admin/elections/:id',                authAdmin, election.getElectionById);
router.put ('/admin/elections/:id',                authAdmin, election.updateElection);
router.patch('/admin/elections/:id/status',        authAdmin, election.updateElectionStatus);
router.delete('/admin/elections/:id',              authAdmin, election.deleteElection);
router.post('/admin/elections/:id/positions',      authAdmin, election.createPosition);
router.put ('/admin/elections/:id/positions/:positionId', authAdmin, election.updatePosition);
router.delete('/admin/elections/:id/positions/:positionId', authAdmin, election.deletePosition);

// ── CANDIDATES (ADMIN) ────────────────────────────────────
router.get ('/admin/candidates',                   authAdmin, candidate.getAllCandidates);
router.post('/admin/candidates',                   authAdmin, candidate.addCandidate);
router.put ('/admin/candidates/:id',               authAdmin, candidate.updateCandidate);
router.patch('/admin/candidates/:id/status',       authAdmin, candidate.approveCandidate);
router.delete('/admin/candidates/:id',             authAdmin, candidate.deleteCandidate);

// ── STUDENTS (ADMIN) ──────────────────────────────────────
router.get ('/admin/students',                     authAdmin, student.getAllStudents);
router.get ('/admin/students/stats',               authAdmin, student.getStudentStats);
router.get ('/admin/students/:id',                 authAdmin, student.getStudent);
router.patch('/admin/students/:id/verify',         authAdmin, student.verifyStudent);
router.patch('/admin/students/:id/toggle-active',  authAdmin, student.toggleStudentActive);
router.post('/admin/students/bulk-verify',         authAdmin, student.bulkVerify);

// ── DASHBOARD / MONITORING ────────────────────────────────
router.get ('/admin/dashboard',                    authAdmin, dashboard.getDashboardStats);
router.get ('/admin/monitoring/:election_id',       authAdmin, dashboard.getLiveMonitoring);
router.get ('/admin/audit-logs',                   authAdmin, dashboard.getAuditLogs);
router.get ('/admin/elections/:election_id/results', authAdmin, voting.adminGetResults);
router.get ('/admin/elections/:election_id/report',  authAdmin, dashboard.generateReport);
router.post('/admin/notifications',                authAdmin, dashboard.createNotification);

// ── STUDENT VOTING ────────────────────────────────────────
router.get ('/elections',                          authStudent, election.getStudentElections);
router.get ('/elections/:id/candidates',           authStudent, election.getElectionCandidates);
router.get ('/elections/:election_id/token',       authStudent, voting.getVotingToken);
router.post('/elections/vote',                     authStudent, voting.castVote);
router.get ('/elections/:election_id/results',     authStudent, voting.getResults);
router.get ('/elections/:election_id/status',      authStudent, voting.checkVotingStatus);
router.get ('/notifications',                      authStudent, dashboard.getNotifications);

module.exports = router;

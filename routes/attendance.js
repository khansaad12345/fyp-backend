const express = require("express")
const attendanceController = require("../controllers/attendance.js");
const router = express.Router();


// Endpoint to submit attendance
router.post('/submit-attendance',attendanceController.takeAttendance);

router.get('/get-attendance',attendanceController.getAttendance);

router.get('/student-attendance',attendanceController.getStudentAttendance);

router.get('/export-attendance',attendanceController.exportAttendance);

router.get('/low-attendance',attendanceController.getLowAttendanceStudents);
router.post('/send-low-attendance-emails', attendanceController.sendLowAttendanceEmails);

router.post('/generate-code', attendanceController.generateQrCode);

router.get('/export-student-attendance',attendanceController.exportStudentAttendance);

router.post('/take-attendance', attendanceController.takeAttendanceViaQr);
module.exports = router
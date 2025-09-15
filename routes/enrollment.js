const express = require("express")
const enrollmentController = require("../controllers/enrollment.js");
const router = express.Router();

router.post("/student-enrollment",enrollmentController.enrollStudentByRegistration);

router.get("/enrolled-students",enrollmentController.getAllEnrollments);

router.get('/enrollments',enrollmentController.getEnrollment);

router.get("/export-students",enrollmentController.exportEnrollmentsToExcel);

router.get('/enrollments/:id',enrollmentController.getEnrollments);

router.put('/enrollments/:id', enrollmentController.updateEnrollment);

router.delete('/enrollments/:id',enrollmentController.deleteEnrollment);

router.get('/enrolled-student',enrollmentController.getStudent);

router.get('/student/:studentId',enrollmentController.getStudentCourses);


router.get('/course-years/:studentId',enrollmentController.getStudentCourseYears);

router.get('/students/:studentId',enrollmentController.getStdClassCourses);
module.exports = router;
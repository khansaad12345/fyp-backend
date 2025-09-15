const express = require("express")
const courseController = require("../controllers/course.js");
const router = express.Router();

router.post("/create-course",courseController.createCourse)

router.get("/courses",courseController.getAllCourses)

// get particular course 
router.get('/courses/:id',courseController.getCourse);

// New route for fetching courses by class
router.get('/courses/class/:classId', courseController.getCoursesByClass);

//update course
router.put('/courses/:id',courseController.updateCourse);
router.delete('/courses/:id',courseController.deleteCourse);

// export to exel rout
router.get("/export-course",courseController.exportCoursesToExcel);

router.get('/teacher/:teacherId/stats',courseController.getTotalClassCourse);

// Get all unique current sessions for a specific teacher
router.get('/teacher/:teacherId/sessions',courseController.getSession);

router.get('/teacher/:teacherId',courseController.getTeacherCourses);
router.get('/sessions', courseController.getSessions);

router.get('/session-courses', courseController.getCoursesBySession);

module.exports = router;
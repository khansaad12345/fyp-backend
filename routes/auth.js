const express = require("express")
const authController = require("../controllers/auth.js");
const { auth, authorize } = require("../middlewares/auth");
const router = express.Router();
// route for admin signup 
router.post("/signup",authController.signup)

//get admin data
router.get("/admin",authController.getAdmin)

// route for teacher register 
router.post("/register", authController.register)
// route for getting all teachers record 
router.get("/teachers",authController.getAllTeachers)

router.get("/export-teacher",authController.exportteacherToExcel);

router.get("/export-student",authController.exportstudentToExcel);

// route for register student 
router.post("/register-student",authController.registerStudent)

// route for getting students
router.get("/students",authController.getAllStudents)

// get particular student 
router.get('/students/:id',authController.getStudent);

//update student
router.put('/students/:id',authController.updateStudent);

// delet student
router.delete("/students/:id",authController.deleteStudent)

// get particular teacher 
router.get('/teachers/:id',authController.getTeacher);

//update student
router.put('/teachers/:id',authController.updateTeacher);


//delete teacher

router.delete('/teachers/:id',authController.deleteTeacher);

// route for login 
router.post("/login",authController.login)

router.get('/dashboard', auth, authorize("admin", "teacher","student"), (req, res) => {
    res.status(200).json({
        status: 'success',
        message: `Welcome ${req.user.role} to the dashboard!`,  // Make response dynamic
        data: { user: req.user },
    });
});

// route for logout 
router.post("/logout",authController.logout)
module.exports = router;
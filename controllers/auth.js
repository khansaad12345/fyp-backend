const mongoose = require('mongoose');
const User = require("../models/admin.js");
const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync.js");
const AppError = require("../utils/appError.js");
const Admin = require("../models/admin.js");
const Teacher = require("../models/teacher.js");
const CsvParser = require("json2csv").Parser;
const Student = require("../models/student.js");
require("dotenv").config();
const validator = require("validator");
const bcryptjs = require("bcryptjs");
const Enrollment = require('../models/enrollment.js');

// JWT Token Signing
const signToken = (userId,role) => {
    return jwt.sign({ userId ,role}, process.env.SECRETKEY, { expiresIn: "7d" });
};

// Create and Send Token
const createSendToken = async (user, statusCode, res, message) => {
    const token = signToken(user._id,user.role); // Removed unnecessary `await`

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Cookie expiration
    };
    res.cookie("token", token, cookieOptions);

    user.password = undefined;
    res.status(statusCode).json({
        status: "success",
        message,
        token,
        data: { user },
    });
};

// Admin Signup Controller
exports.signup = catchAsync(async (req, res, next) => {
    const { name, email, password,} = req.body;

    // Check if email already exists
    const checkEmailExist = await Admin.findOne({ email });
    if (checkEmailExist) {
        return next(new AppError("Email is already registered", 400));
    }


    // Create User
    const user = await Admin.create({
        name,
        email,
        password,
    });

    createSendToken(user, 200, res, "Registration successful");
   
});

// get Admin data 

exports.getAdmin = async (req,res)=>{

try {
  // Find the student by ID
  const admin = await Admin.find();

  if (!admin) {
    return res.status(404).json({ message: 'Admin not found' });
  }

  // Send the student record as a response
  res.status(200).json({ admin });
} catch (error) {
  console.error('Error fetching admin:', error);
  res.status(500).json({ message: 'Failed to fetch admin' });
}
}

// teacher sign up

exports.register = catchAsync(async (req, res, next) => {
    const { name, email, password,} = req.body;

    // Check if email already exists
    const checkEmailExist = await Teacher.findOne({ email });
    if (checkEmailExist) {
        return next(new AppError("Email is already registered", 400));
    }


    // Create User
    const user = await Teacher.create({
        name,
        email,
        password,
    });

    createSendToken(user, 200, res, "Registration successful");
   
});


// student registration 

exports.registerStudent = catchAsync(async (req, res, next) => {
    const { name, email, password,reg_No} = req.body;

    // Check if email already exists
    const checkEmailExist = await Student.findOne({ reg_No });
    if (checkEmailExist) {
        return next(new AppError("Student is already registered", 400));
    }


    // Create User
    const user = await Student.create({
        name,
        email,
        password,
        reg_No
    });

    createSendToken(user, 200, res, "Registration successful");
   
});

// get particular record

exports.getStudent = async (req,res)=>{
    const { id } = req.params;

  try {
    // Find the student by ID
    const student = await Student.findById(id);

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Send the student record as a response
    res.status(200).json({ student });
  } catch (error) {
    console.error('Error fetching student:', error);
    res.status(500).json({ message: 'Failed to fetch student' });
  }
}

// update student 

exports.updateStudent = async (req, res) => {
  const { id } = req.params; // Student ID
  const { name, email, password, reg_No } = req.body;

  try {
    // Validate input fields
    if (!name || !email || !reg_No) {
      return res
        .status(400)
        .json({ message: "All fields are required except password." });
    }

    // Check if email is valid
    if (!validator.isEmail(email)) {
      return res
        .status(400)
        .json({ message: "Please provide a valid email address." });
    }

    // Check if the student ID is valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid student ID format." });
    }

    // Find the student by ID
    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    // Update fields
    student.name = name;
    student.email = email;
    student.reg_No = reg_No;

    // Update password only if provided
    if (password) {
      if (password.length < 8) {
        return res
          .status(400)
          .json({ message: "Password must be at least 8 characters long." });
      }
      student.password = password; // Hashing will be handled by pre-save middleware
    }

    // Save updated student
    await student.save();

    res.status(200).json({
      message: "Student updated successfully.",
      student,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    res.status(500).json({
      message: "An error occurred while updating the student.",
      error: error.message,
    });
  }
};

// delete student record

exports.deleteStudent = async(req,res)=>{
    const studentId = req.params.id;

  // Validate the provided ID format
  if (!mongoose.Types.ObjectId.isValid(studentId)) {
    return res.status(400).json({ error: 'Invalid student ID format' });
  }

  try {
    // Find and delete the student by ID
    const deletedStudent = await Student.findById(studentId);
        await deletedStudent.deleteOne();
    if (!deletedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({
      message: 'Student record deleted successfully',
      student: deletedStudent,
    });
  } catch (error) {
    console.error('Error deleting student record:', error);

    // Handle specific MongoDB errors
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid ID provided' });
    }

    // General error fallback
    res.status(500).json({ error: 'Failed to delete student record' });
  }
}


// getting all teachers
exports.getAllTeachers = catchAsync(async (req, res, next) => {
   // Extract pagination parameters from the query string
   const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not provided
   const limit = parseInt(req.query.limit, 10) || 5; // Default to 5 items per page
   const skip = (page - 1) * limit; // Calculate the number of documents to skip
 
    // Fetch all teachers and exclude the 'password' field
    const teachers = await Teacher.find()
    .select('-password')
    .sort({createdAt:-1})
    .skip(skip)
    .limit(limit);;

    // Count the total number of teachers in the database
  const totalTeachers = await Teacher.countDocuments();
    // Handle case when no teachers are found
    if (!teachers || teachers.length === 0) {
        return next(new AppError("No teachers found in the database.", 404));
    }

    const totalPages = Math.ceil(totalTeachers / limit);

    res.status(200).json({
        status: "success",
        results: teachers.length,
        totalTeachers,
        totalPages,
      currentPage: page,
      hasNextPage: page < totalPages, // If there's a next page
      hasPrevPage: page > 1, // If there's a previous page
        teachers,
    });
});

// get particular teacher
exports.getTeacher = async (req,res)=>{
  const { id } = req.params;

try {
  // Find the student by ID
  const teacher = await Teacher.findById(id);

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' });
  }

  // Send the student record as a response
  res.status(200).json({ teacher });
} catch (error) {
  console.error('Error fetching teacher:', error);
  res.status(500).json({ message: 'Failed to fetch teacher' });
}
}

//update the teacher

exports.updateTeacher = async (req, res) => { 
  const { id } = req.params; // Teacher ID
  const { name, email, password } = req.body;

  try {
    // Validate input fields
    if (!name || !email) {
      return res.status(400).json({
        message: "Name and email are required fields.",
      });
    }

    // Check if email is valid
    if (!validator.isEmail(email)) {
      return res.status(400).json({ message: "Please provide a valid email address." });
    }

    // Check if the teacher ID is valid
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid teacher ID format." });
    }

    // Find the teacher by ID
    const teacher = await Teacher.findById(id).select("+password");
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    // Update fields
    teacher.name = name;
    teacher.email = email;

    // Update password only if provided
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters long." });
      }
      teacher.password = await bcryptjs.hash(password, 10); // Fix: Hash password before saving
    }

    // Save updated teacher
    await teacher.save();

    res.status(200).json({
      message: "Teacher updated successfully.",
      teacher: {
        name: teacher.name,
        email: teacher.email,
        role: teacher.role,
        updatedAt: teacher.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error updating teacher:", error);
    res.status(500).json({
      message: "An error occurred while updating the teacher.",
      error: error.message,
    });
  }
};


//delete teacher

exports.deleteTeacher = async (req, res) => {
    const teacherId = req.params.id;

    // Validate teacher ID
    if (!mongoose.Types.ObjectId.isValid(teacherId)) {
        return res.status(400).json({ error: "Invalid teacher ID format." });
    }

    try {
        // Attempt to delete the teacher
        const deletedTeacher = await Teacher.findOneAndDelete({ _id: teacherId });

        if (!deletedTeacher) {
            return res.status(404).json({ error: "Teacher not found." });
        }

        res.status(200).json({ message: "Teacher deleted successfully." });
    } catch (error) {
        console.error("Error deleting teacher:", error.message);
        res.status(error.statusCode || 500).json({ error: error.message || "Failed to delete teacher." });
    }
};

exports.exportteacherToExcel = catchAsync(async (req, res, next) => {
    try {
        const teacher = await Teacher.find(); // Ensure this is working and returns data

        if (!teacher || teacher.length === 0) {
            return next(new AppError("No teacher found to export.", 404));
        }

        const csvData = teacher.map((teacher) => ({
            "Teacher ID": teacher._id,
            "Teacher Name": teacher.name,
            "Email": teacher.email,
            "Role": teacher.role
        }));

        const fields = ["Teacher ID", "Teacher Name", "Email", "Role"];
        const csvParser = new CsvParser({ fields });
        const csv = csvParser.parse(csvData);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=TeachersData.csv");

        res.status(200).end(csv);
    } catch (error) {
        console.error(error); // Log the error for debugging
        return next(new AppError("Internal server error while exporting teachers.", 500));
    }
});


exports.exportstudentToExcel = catchAsync(async (req, res, next) => {
    try {
        const student = await Student.find(); // Ensure this is working and returns data

        if (!student || student.length === 0) {
            return next(new AppError("No student found to export.", 404));
        }

        const csvData1 = student.map((student) => ({
            "Registration Number": student.reg_No,
            "student Name": student.name,
            "Email": student.email,
            "Role": student.role
        }));

        const fields = ["Registration Number", "student Name", "Email", "Role"];
        const csvParser = new CsvParser({ fields });
        const csv = csvParser.parse(csvData1);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=studentsData.csv");

        res.status(200).end(csv);
    } catch (error) {
        console.error(error); // Log the error for debugging
        return next(new AppError("Internal server error while exporting students.", 500));
    }
});

// getting all students 

exports.getAllStudents = catchAsync(async (req, res, next) => {
  // Extract and validate pagination parameters
  const page = parseInt(req.query.page, 10) || 1; // Default to page 1
  const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 records per page
  const skip = (page - 1) * limit; // Calculate number of records to skip

  // Fetch paginated students and count total records
  const [students, totalStudents] = await Promise.all([
    Student.find()
      .select('-password')
      .sort({createdAt:-1}) // Exclude sensitive fields
      .skip(skip)
      .limit(limit),
    Student.countDocuments(), // Total number of students
  ]);

  // Check if no students are found
  if (students.length === 0) {
    return next(new AppError("No students found in the database.", 404));
  }

  // Calculate total pages
  const totalPages = Math.ceil(totalStudents / limit);

  // Send the response
  res.status(200).json({
    status: "success",
    results: students.length, // Records on the current page
    totalStudents, // Total number of students
    totalPages, // Total pages
    currentPage: page, // Current page
    hasNextPage: page < totalPages, // If there's a next page
    hasPrevPage: page > 1, // If there's a previous page
    students, // Student data
  });
});





exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
      return next(new AppError("Please provide email and password.", 400));
  }

  let user;
  
  try {
      const [admin, teacher, student] = await Promise.all([
          Admin.findOne({ email }).select("+password"),
          Teacher.findOne({ email }).select("+password"),
          Student.findOne({ email }).select("+password"),
      ]);

      user = admin || teacher || student;

      if (!user) {
          return next(new AppError("Incorrect email or password.", 401));
      }

      const isPasswordCorrect = await user.correctPassword(password, user.password);
      if (!isPasswordCorrect) {
          return next(new AppError("Incorrect email or password.", 401));
      }

      createSendToken(user, 200, res, "Login successful");
  } catch (error) {
      console.error("❌ Login error:", error);
      return next(new AppError("Internal Server Error", 500));
  }
});
exports.logout = catchAsync(async(req,res,next)=>{
    res.cookie("token","logout",{
      expires: new Date(0), // Expire immediately
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Only secure in production
      sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    })

    res.status(200).json({
        status:"success",
        message:"logout successfully",
    })
})


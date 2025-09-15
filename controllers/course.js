const Course = require('../models/course');
const Teacher = require('../models/teacher'); // Ensure you have a Teacher model
const Class = require('../models/class'); // Ensure you have a Class model
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const { default: mongoose } = require('mongoose');
const CsvParser = require("json2csv").Parser;


// Create Course API
const createCourse = catchAsync(async (req, res, next) => {
    const { courseCode, courseName, year, class: classId, currentTeacher } = req.body;

    // Validate required fields
    if (!courseCode || !courseName || !year || !classId || !currentTeacher) {
        return next(new AppError("All fields are required.", 400));
    }

    // Check if the teacher and class exist
    const teacherExists = await Teacher.findById(currentTeacher);
    const classExists = await Class.findById(classId);

    if (!teacherExists) {
        return next(new AppError("Teacher not found.", 404));
    }

    if (!classExists) {
        return next(new AppError("Class not found.", 404));
    }

    // Check if the course already exists
    let existingCourse = await Course.findOne({ courseCode, year });

    if (existingCourse) {
        // Check if the class-teacher mapping already exists
        const classExistsInCourse = existingCourse.classes.find(
            (entry) => entry.class.toString() === classId && entry.teacher.toString() === currentTeacher
        );

        if (classExistsInCourse) {
            return next(new AppError("This course already exists for the selected class and teacher.", 400));
        }

        // Add new class-teacher mapping to the existing course
        existingCourse.classes.push({ class: classId, teacher: currentTeacher });
        await existingCourse.save();

        return res.status(200).json({
            message: "Course updated successfully with new class-teacher mapping.",
            course: existingCourse,
        });
    }

    // If the course doesn't exist, create a new course
    const newCourse = new Course({
        courseCode,
        courseName,
        year,
        classes: [{ class: classId, teacher: currentTeacher }],
    });

    await newCourse.save();

    res.status(201).json({
        status:"success",
        message: "Course created successfully.",
        course: {newCourse},
    });
});

// get particular course 
const getCourse = async (req,res)=>{
    const { id } = req.params;
  
  try {
    // Find the student by ID
    const course = await Course.findById(id);
  
    if (!course) {
      return res.status(404).json({ message: 'course not found' });
    }
  
    // Send the student record as a response
    res.status(200).json({ course });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ message: 'Failed to fetch course' });
  }
  }

  // update 
  const updateCourse = async (req,res)=>{
    const { id } = req.params; // Course ID
    const { courseCode, courseName, year, classes } = req.body;

    try {
        // Validate course existence
        const course = await Course.findById(id);
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }

        // Update course details
        course.courseCode = courseCode || course.courseCode;
        course.courseName = courseName || course.courseName;
        course.year = year || course.year;

        // Handle teacher-class associations
        if (classes) {
            const updatedClasses = classes.map((item) => ({
                teacher: item.teacher,
                class: item.class,
            }));
            course.classes = updatedClasses; // Replace with updated teacher-class records
        }

        await course.save(); // Save updated course to the database

        res.status(200).json({
            message: 'Course updated successfully',
            course,
        });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
  }

  // Fetch all courses
  const getAllCourses = catchAsync(async (req, res, next) => {
    // Get page and limit from query parameters with defaults
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const courses = await Course.find()
        .skip(skip)
        .limit(limit)
        .populate('classes.class', 'className classCode shift section')
        .populate('classes.teacher', 'name');

    const totalCourses = await Course.countDocuments();
    const totalPages = Math.ceil(totalCourses / limit);
    if (!courses || courses.length === 0) {
        return next(new AppError("No courses found in the database.", 404));
    }

    res.status(200).json({
        status: "success",
        results: courses.length,
        totalCourses,
        currentPage: page,
        totalPages,
        hasNextPage: page < totalPages, // If there's a next page
        hasPrevPage: page > 1, // If there's a previous page
        courses,
    });
});

// Fetch courses by class
const getCoursesByClass = catchAsync(async (req, res, next) => {
    const { classId } = req.params;

    if (!classId) {
        return next(new AppError("Class ID is required to fetch courses.", 400));
    }

    const courses = await Course.find({ 'classes.class': classId })
        .populate('classes.class', 'className classCode shift section')
        .populate('classes.teacher', 'name');

    if (!courses || courses.length === 0) {
        return next(new AppError("No courses found for the specified class.", 404));
    }

    res.status(200).json({
        status: "success",
        results: courses.length,
        courses,
    });
});


const deleteCourse = async (req,res)=>{
    const courseId = req.params.id;

    // Validate course ID
    if (!mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ error: 'Invalid course ID format.' });
    }

    try {
        // Attempt to delete the course
        const deletedCourse = await Course.findOneAndDelete({ _id: courseId });

        if (!deletedCourse) {
            return res.status(404).json({ error: 'Course not found.' });
        }

        res.status(200).json({ message: 'Course deleted successfully.' });
    } catch (error) {
        console.error('Error deleting course:', error.message);
        res.status(error.statusCode || 500).json({ error: error.message || 'Failed to delete course.' });
    }
}

    // get data to excel form
const exportCoursesToExcel = catchAsync(async (req, res, next) => {
    // Fetch courses and populate related information
    const courses = await Course.find()
        .populate("classes.class", "className classCode shift section")
        .populate("classes.teacher", "name");

    // Check if there are courses to export
    if (!courses || courses.length === 0) {
        return next(new AppError("No courses found to export.", 404));
    }

    // Prepare data for the CSV
    const csvData = courses.map((course) => {
        // Extract all teacher names for the course
        const teacherNames = course.classes
            .map((cls) => cls.teacher?.name) // Extract teacher names
            .filter((name) => name) // Exclude undefined/null names
            .join(", "); // Join names with a comma separator

        // Extract all class details for the course
        const classDetails = course.classes
            .map((cls) => {
                const classData = cls.class;
                return `${classData?.className || "N/A"} (${classData?.classCode || "N/A"}, ${classData?.shift || "N/A"}, ${classData?.section || "N/A"})`;
            })
            .join("; "); // Join class details with a semicolon separator

        return {
            "Course Code": course.courseCode || "N/A",
            "Course Name": course.courseName || "N/A",
            "Year": course.year || "N/A",
            "Teacher Name(s)": teacherNames || "N/A",
            "Class Details": classDetails || "N/A",
        };
    });

    // Define CSV fields
    const fields = [
        "Course Code",
        "Course Name",
        "Year",
        "Teacher Name(s)",
        "Class Details",
    ];

    // Initialize CSV parser
    const { Parser } = require("json2csv");
    const csvParser = new Parser({ fields });
    const csv = csvParser.parse(csvData);

    // Set headers for file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=CourseData.csv");

    // Send the CSV file as the response
    res.status(200).end(csv);
});

  
// get total classes and courses for teacher

const getTotalClassCourse = async (req,res)=>{
    try {
        const { teacherId } = req.params;

        // Find all courses where the teacher is assigned in classes
        const courses = await Course.find({ 'classes.teacher': teacherId });

        // Count total courses
        const totalCourses = courses.length;

        // Count total classes assigned to this teacher
        const totalClasses = courses.reduce((count, course) => {
            return count + course.classes.filter(cls => cls.teacher.toString() === teacherId).length;
        }, 0);

        res.json({ totalCourses, totalClasses });

    } catch (error) {
        console.error('Error fetching teacher stats:', error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
}

const getSession = async (req,res)=>{
    try {
        const { teacherId } = req.params;

        // Find all sessions where the teacher has taught
        const sessions = await Course.distinct("year", {
            "classes.teacher": teacherId
        });

        res.status(200).json({ success: true, sessions });
    } catch (error) {
        console.error("Error fetching Year:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

const getTeacherCourses = async (req,res)=>{
    try {
        const { teacherId } = req.params;
        const { session } = req.query; // Session comes from query params
        // const year = "2024-25"; // Set the default session here

        const selectedSession = session; // Use provided session or default

        // Find courses where the teacher is assigned in the selected session
        const courses = await Course.find({
            year: selectedSession,
            "classes.teacher":teacherId
        }).populate("classes.class").populate("classes.teacher");

        res.status(200).json({ success: true, courses });
    } catch (error) {
        console.error("Error fetching courses:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

const getSessions = async (req, res) => {
    try {
        const sessions = await Course.distinct('year'); // Fetch unique sessions
        res.status(200).json({ sessions });
    } catch (error) {
        console.error('Error fetching years:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}

const getCoursesBySession = async (req, res) => {
    try {
        const { session } = req.query; // Session comes from query params
        const selectedSession = session;

        // Find courses where the teacher is assigned in the selected session
        const courses = await Course.find({
            year: selectedSession
        }).populate("classes.class").populate("classes.teacher");

        // Extract unique classes
        const uniqueClasses = [];
        const classKeys = new Set(); // To track unique class keys

        courses.forEach((course) => {
            course.classes.forEach((cls) => {
                // Ensure the class object is populated and has the required properties
                if (cls.class && cls.class._id) {
                    // Create a unique key for each class using its properties
                    const classKey = `${cls.class.className}-${cls.class.classCode}-${cls.class.shift}-${cls.class.section}`;

                    // Check if the class key is already in the Set
                    if (!classKeys.has(classKey)) {
                        classKeys.add(classKey); // Add the unique key to the Set
                        uniqueClasses.push(cls.class); // Add the class object to the array
                    }
                }
            });
        });

        res.status(200).json({ success: true, courses, classes: uniqueClasses });
    } catch (error) {
        console.error("Error fetching courses:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};

module.exports = { createCourse , getAllCourses , getCoursesByClass,  deleteCourse, getCourse,updateCourse,exportCoursesToExcel, getTotalClassCourse , getSession ,getTeacherCourses , getSessions , getCoursesBySession};

const catchAsync = require('../utils/catchAsync');
const Student = require('../models/student.js');
const Course = require('../models/course');
const Class = require('../models/class');
const Enrollment = require('../models/enrollment');
const AppError = require('../utils/appError');
const { default: mongoose } = require('mongoose');
const CsvParser = require("json2csv").Parser;

const enrollStudentByRegistration = catchAsync(async (req, res, next) => {
    const { registrationNumbers, classId, courseIds } = req.body;

    // Validate the input
    if (!registrationNumbers || !Array.isArray(registrationNumbers) || registrationNumbers.length === 0) {
        return next(new AppError("At least one registration number is required.", 400));
    }
    if (!classId) {
        return next(new AppError("Class ID is required.", 400));
    }
    if (!Array.isArray(courseIds) || courseIds.length === 0) {
        return next(new AppError("At least one course ID is required.", 400));
    }

    // Validate the classId
    const classExists = await Class.findById(classId);
    if (!classExists) {
        return next(new AppError("Class with the given ID not found.", 404));
    }

    // Determine the current session from the courses
    const courses = await Course.find({ _id: { $in: courseIds } });
    if (courses.length !== courseIds.length) {
        return next(new AppError("One or more course IDs are invalid.", 404));
    }

    // Ensure all courses belong to the same session
    const year = courses[0].year;
    if (!courses.every((course) => course.year === year)) {
        return next(new AppError("All courses must belong to the same year.", 400));
    }

    try {
        const results = [];

        // Loop through each registration number to process enrollment
        for (const registrationNumber of registrationNumbers) {
            // Check if the student exists based on the registration number
            const student = await Student.findOne({ reg_No: { $regex: new RegExp(`^${registrationNumber}$`, 'i') } });
            if (!student) {
                results.push({
                    registrationNumber,
                    status: "failed",
                    message: "Student with this registration number not found.",
                });
                continue;
            }

            const studentId = student._id;

            // Check for existing enrollment to prevent duplication
            const existingEnrollment = await Enrollment.findOne({
                student: studentId,
                class: classId,
                course: { $in: courseIds },
            });

            if (existingEnrollment) {
                results.push({
                    registrationNumber,
                    status: "failed",
                    message: "Student is already enrolled in one or more specified courses for this year.",
                });
                continue;
            }

            // Create a new enrollment
            const newEnrollment = new Enrollment({
                student: studentId,
                course: courseIds,
                class: classId,
                session: year,
            });
            await newEnrollment.save();

            results.push({
                registrationNumber,
                status: "success",
                message: "New enrollment created successfully.",
                enrollment: newEnrollment,
            });
        }

        return res.status(200).json({
            message: "Enrollment processing completed.",
            results,
        });
    } catch (error) {
        return next(new AppError(error.message, 400));
    }
});


const getAllEnrollments = catchAsync(async (req, res, next) => {
    // Fetch all enrollments and populate related student, course, and class information
    const enrollments = await Enrollment.find()
        .sort({createdAt:-1})
        .populate('student', 'name reg_No') // Fetch student details
        .populate('course', 'courseCode courseName year') // Fetch course details
        .populate('class', 'className classCode shift section'); // Fetch class details

    // Check if enrollments exist
    if (!enrollments || enrollments.length === 0) {
        return next(new AppError("No enrollments found.", 404));
    }

    res.status(200).json({
        status: "success",
        results: enrollments.length,
        enrollments,
    });
});

const exportEnrollmentsToExcel = catchAsync(async (req, res, next) => {
    // Fetch enrollments and populate related information
    const enrollments = await Enrollment.find()
        .populate("student", "name reg_No")
        .populate("course", "courseCode courseName year")
        .populate("class", "className classCode shift section");

        enrollments.forEach((enrollment) => {
            console.log(JSON.stringify(enrollment.course, null, 2)); // Expands the course array
        });
        
    // Check if there are enrollments to export
    if (!enrollments || enrollments.length === 0) {
        return next(new AppError("No enrollments found to export.", 404));
    }

    // Prepare data for the CSV
    const csvData = enrollments.map((enrollment) => {
        // Extract and join multiple courses for vertical display
        const courseCodes = enrollment.course
            .map((course) => course.courseCode) // Extract course codes
            .join(","); // Join codes vertically
    
        const courseNames = enrollment.course
            .map((course) => course.courseName) // Extract course names
            .join(","); // Join names vertically
    
        // For sessions, ensure they are unique and only displayed once
        const session = enrollment.course[0]?.year || "N/A"; // First session only (as per your requirement)
    
        return {
            "Registration Number": enrollment.student?.reg_No || "N/A",
            "Student Name": enrollment.student?.name || "N/A",
            "Course Code": courseCodes || "N/A", // Combined vertically
            "Course Name": courseNames || "N/A", // Combined vertically
            "Year": session || "N/A", // First session only
            "Class Name": enrollment.class?.className || "N/A",
            "Class Code": enrollment.class?.classCode || "N/A",
            "Shift": enrollment.class?.shift || "N/A",
            "Section": enrollment.class?.section || "N/A",
            "Enrollment Date": enrollment.enrollmentDate.toISOString(),
        };
    });

    // Define CSV fields
    const fields = [
        "Student Name",
        "Registration Number",
        "Course Code",
        "Course Name",
        "Year",
        "Class Name",
        "Class Code",
        "Shift",
        "Section",
        "Enrollment Date",
    ];

    // Initialize CSV parser
    const csvParser = new CsvParser({ fields });
    const csv = csvParser.parse(csvData);

    // Set headers for file download
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=EnrollmentData.csv");

    // Send the CSV file as the response
    res.status(200).end(csv);
});

// get particular enrollment 
const getEnrollments = async (req,res)=>{
    const id  = req.params.id;
  
  try {
    // Find the student by ID
    const enrollment = await Enrollment.findById(id).populate("student", "reg_No");
  
    if (!enrollment) {
      return res.status(404).json({ message: 'enrollment not found' });
    }
  
    // Send the student record as a response
    res.status(200).json({status:"success", enrollment });
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ message: 'Failed to fetch course' });
  }
  }

// get enrollment of particular date

const getEnrollment = async (req,res)=>{
    try {
        const { startDate, endDate } = req.query;

        // Validate the input dates
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Both startDate and endDate are required' });
        }

        // Convert to Date objects
        const start = new Date(new Date(startDate).setHours(0, 0, 0, 0)); // Start of the day
const end = new Date(new Date(endDate).setHours(23, 59, 59, 999)); // End of the day

        // Find enrollments within the specified date range
        const enrollments = await Enrollment.find({
            enrollmentDate: {
                $gte: start,
                $lte: end,
            },
        }).populate('student', 'name reg_No') // Fetch student details
        .populate('course', 'courseCode courseName year') // Fetch course details
        .populate('class', 'className classCode shift section'); // Fetch class details

        res.status(200).json({ success: true,enrollments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
}

const updateEnrollment = catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { courseIds, classId } = req.body;
  
    // Validate input
    if (!courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return next(new AppError("At least one course ID is required.", 400));
    }
  
    // Check if enrollment exists
    const enrollment = await Enrollment.findById(id);
    if (!enrollment) {
      return next(new AppError("Enrollment not found.", 404));
    }
  
    // If a new classId is provided, validate it
    if (classId) {
      const classExists = await Class.findById(classId);
      if (!classExists) {
        return next(new AppError("Class with the given ID not found.", 404));
      }
  
      // Update the classId in the enrollment
      enrollment.class = classId;
    }
  
    // Validate the provided courseIds
    const courses = await Course.find({ _id: { $in: courseIds } });
    if (courses.length !== courseIds.length) {
      return next(new AppError("One or more course IDs are invalid.", 404));
    }
  
    // Ensure all courses belong to the same session
    const currentSession = courses[0].currentSession;
    if (!courses.every((course) => course.currentSession === currentSession)) {
      return next(new AppError("All courses must belong to the same year.", 400));
    }
  
    // Ensure all courses belong to the same class
    const firstClassId = courses[0].classes[0].class.toString();
    const allFromSameClass = courses.every((course) => 
      course.classes.some((cls) => cls.class.toString() === firstClassId)
    );
    
    if (!allFromSameClass) {
      return next(new AppError("Please select courses from the same class.", 400));
    }
  
    // Update the courses in the enrollment
    enrollment.course = courseIds;
  
    // Save the updated enrollment
    await enrollment.save();
  
    return res.status(200).json({
      status: "success",
      message: "Enrollment updated successfully.",
      enrollment,
    });
  }); 


const deleteEnrollment = async(req,res)=>{
    const enrollmentId = req.params.id;

    // Validate the ID format
    if (!mongoose.Types.ObjectId.isValid(enrollmentId)) {
        return res.status(400).json({ message: 'Invalid enrollment ID format.' });
    }

    try {
        // Attempt to find and delete the enrollment
        const deletedEnrollment = await Enrollment.findByIdAndDelete(enrollmentId);

        // If the enrollment doesn't exist
        if (!deletedEnrollment) {
            return res.status(404).json({ message: 'Enrollment not found.' });
        }

        // Successfully deleted
        res.status(200).json({
            status:"success",
            message: 'Enrollment deleted successfully.',
            enrollment: deletedEnrollment,
        });
    } catch (error) {
        console.error('Error deleting enrollment:', error.message);

        // General fallback error
        res.status(500).json({ message: 'Failed to delete enrollment.' });
    }
}

const getStudent = async (req,res)=>{
    try {
        const { courseId, classId } = req.query;

        if (!courseId || !classId) {
            return res.status(400).json({ message: 'Course ID and Class ID are required' });
        }

        const enrollments = await Enrollment.find({ course: courseId, class: classId })
            .populate('student', 'name reg_No');

        const students = enrollments.map(enrollment => enrollment.student);

        res.status(200).json({ students });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error', error });
    }
}

const getStudentCourses = async (req,res)=>{
    try {
        const { studentId } = req.params;
       // const { session } = req.query; // Session comes from query params
        // const year = "2024-25"; // Set the default session here

       // const selectedSession = session; // Use provided session or default

        // Find courses where the teacher is assigned in the selected session
        const courses = await Enrollment.find({
          "student":studentId
        }).populate("course");
        const totalCourses = courses.length;
        res.status(200).json({ success: true, totalCourses });
    } catch (error) {
        console.error("Error fetching courses:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}

const getStudentCourseYears = async (req, res) => {
    try {
        const { studentId } = req.params;

        // Fetch enrollments and populate the 'course' field
        const enrollments = await Enrollment.find({ student: studentId }).populate("course");

        // Extract unique years from the populated course field
        const years = [...new Set(
            enrollments.flatMap(enrollment => 
                enrollment.course.map(course => course.year) // Assuming 'year' exists in the course schema
            )
        )];

        res.status(200).json({ success: true, years });
    } catch (error) {
        console.error("Error fetching course years:", error.message);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};
// get student class and course based on year 
const getStdClassCourses = async (req, res) => {
    const { studentId } = req.params;
    const { year } = req.query; // Get year from query parameters

    if (!studentId || !year) {
        return res.status(400).json({ message: "Student ID and Year are required" });
    }

    try {
        const enrollments = await Enrollment.find({ student: studentId })
            .populate({
                path: 'course',
                match: { year: year },
                select: 'courseCode courseName' // Adjust the fields you want to retrieve
            })
            .populate({
                path: 'class', // Ensure this matches the field name in the schema
                select: 'className classCode shift section' // Adjust the fields you want to retrieve
            })
            .exec();

        // Filter out enrollments where the course doesn't match the year
        const filteredEnrollments = enrollments.filter(enrollment => enrollment.course !== null);

        res.status(200).json({ success: true, totalCourses: filteredEnrollments.length, courses: filteredEnrollments });
    } catch (error) {
        res.status(500).json({ message: "Error fetching enrollments", error: error.message });
    }
};
module.exports = { enrollStudentByRegistration, getAllEnrollments,exportEnrollmentsToExcel, getEnrollments, updateEnrollment , deleteEnrollment,getEnrollment, getStudent , getStudentCourses ,getStudentCourseYears , getStdClassCourses };

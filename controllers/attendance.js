const mongoose = require("mongoose");
const Attendance = require("../models/attendance");
const Enrollment = require('../models/enrollment');
const Class = require('../models/class');
const Course = require('../models/course');
const Teacher = require("../models/teacher.js");
const cron = require('node-cron');
const ExcelJS = require('exceljs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const QrToken = require('../models/QrToken.js'); // Import the QrToken model
const Notification = require('../models/notification');
const wss = require('../websocket.js');
require("dotenv").config();
const takeAttendance = async (req, res) => {
  try {
      const { courseId, classId, teacherId, date, attendance } = req.body;

      // Validate required fields
      if (!courseId || !classId || !teacherId || !attendance) {
          return res.status(400).json({ message: "Missing required fields" });
      }

      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(courseId) || 
          !mongoose.Types.ObjectId.isValid(classId) || 
          !mongoose.Types.ObjectId.isValid(teacherId)) {
          return res.status(400).json({ message: "Invalid ObjectId format" });
      }

      // Validate attendanceRecords is an array
      if (!Array.isArray(attendance) || attendance.length === 0) {
          return res.status(400).json({ message: "Invalid attendance records" });
      }
      if (!date || isNaN(new Date(date).getTime())) {
          return res.status(400).json({ message: 'Invalid date format' });
      }

      // Ensure each record has a valid studentId and status
      for (let record of attendance) {
          if (!record.studentId || !mongoose.Types.ObjectId.isValid(record.studentId)) {
              return res.status(400).json({ message: "Invalid student ID in attendance records" });
          }
          if (!record.status || !["Present", "Absent"].includes(record.status)) {
              return res.status(400).json({ message: "Invalid status in attendance records" });
          }
      }

      // Check if attendance already exists for the same date, course, class, and teacher
      const existingAttendance = await Attendance.findOne({
          course: courseId,
          class: classId,
          teacher: teacherId,
          date: new Date(date),
      });

      if (existingAttendance) {
          return res.status(400).json({ message: "Attendance for this date already exists" });
      }

      // Insert attendance records
      const attendanceEntries = attendance.map(record => ({
          student: record.studentId,
          course: courseId,
          class: classId,
          date: new Date(date),
          teacher: teacherId,
          status: record.status,
      }));

      await Attendance.insertMany(attendanceEntries);

      res.status(200).json({ message: "Attendance submitted successfully" });

  } catch (error) {
      console.error("Error taking attendance:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// attendance through QR Code


const generateQrCode = async (req, res) => {
    try {
        const { courseId, classId, teacherId, date } = req.body;

        // Validate required fields
        if (!courseId || !classId || !teacherId || !date) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Fetch course, class, and teacher details
        const course = await Course.findById(courseId);
        const classDetails = await Class.findById(classId);
        const teacher = await Teacher.findById(teacherId);

        if (!course || !classDetails || !teacher) {
            return res.status(404).json({ message: "Course, class, or teacher not found" });
        }

        // Generate a unique token
        const token = crypto.randomBytes(16).toString('hex');

        // Set expiry time (e.g., 10 minutes from now)
        const expiresAt = new Date(Date.now() + 3 * 60 * 1000);

        // Save the token in the database
        const qrToken = new QrToken({
            token,
            courseId,
            classId,
            teacherId,
            expiresAt,
            date: new Date(date), // Save the date from the frontend
        });
        await qrToken.save();

        // Generate QR code data with names instead of IDs
        const qrCodeData = JSON.stringify({
            token,
            courseName: course.courseName,
            courseCode: course.courseCode,
            className: classDetails.className,
            classCode: classDetails.classCode,
            section: classDetails.section,
            shift: classDetails.shift || null,
            teacherName: teacher.name,
            date: new Date(date),
        });

        // Generate QR code URL
        const qrCodeUrl = await QRCode.toDataURL(qrCodeData);

        // Schedule a task to mark absentees after the QR code expires
        const delay = expiresAt - Date.now(); // Time until expiration
        setTimeout(() => {
            markAbsentees(courseId, classId, teacherId,qrToken.date);
        }, delay);

        res.status(200).json({ qrCodeUrl, expiresAt });
    } catch (error) {
        console.error("Error generating QR code:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const takeAttendanceViaQr = async (req, res) => {
    try {
        const { token, studentId } = req.body;

        // Validate required fields
        if (!token || !studentId) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        // Find the token in the database
        const qrToken = await QrToken.findOne({ token });
        if (!qrToken) {
            return res.status(400).json({ message: "Invalid QR code" });
        }

        // Check if the token has expired
        if (new Date() > qrToken.expiresAt) {
            return res.status(400).json({ message: "QR code has expired" });
        }

        // Check if the student is enrolled in the course/class
        const isStudentEnrolled = await checkStudentEnrollment(studentId, qrToken.courseId, qrToken.classId);
        if (!isStudentEnrolled) {
            return res.status(400).json({ message: "Student is not enrolled in this course/class" });
        }

        // Check if attendance is already marked for this student on this date
        const existingAttendance = await Attendance.findOne({
            student: studentId,
            course: qrToken.courseId,
            class: qrToken.classId,
            date: qrToken.date, // Use the date from the QR code data
        });
        if (existingAttendance) {
            return res.status(400).json({ message: "Attendance already marked for this student" });
        }

        // Mark attendance
        const attendanceEntry = new Attendance({
            student: studentId,
            course: qrToken.courseId,
            class: qrToken.classId,
            date: qrToken.date, // Use the date from the QR code data
            teacher: qrToken.teacherId,
            status: 'Present', // Assuming the student is present if they scan the QR code
        });
        await attendanceEntry.save();

        res.status(200).json({ message: "Attendance marked successfully" });
    } catch (error) {
        console.error("Error marking attendance via QR code:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const markAbsentees = async (courseId, classId, teacherId,date) => {
    try {
        // Fetch all students enrolled in the course and class
        const enrollments = await Enrollment.find({ course: courseId, class: classId });

        // Loop through each enrolled student
        for (const enrollment of enrollments) {
            const studentId = enrollment.student;

            // Check if the student has already marked attendance
            const existingAttendance = await Attendance.findOne({
                student: studentId,
                course: courseId,
                class: classId,
                date: date,
            });

            // If no attendance record exists, mark the student as absent
            if (!existingAttendance) {
                const attendanceEntry = new Attendance({
                    student: studentId,
                    course: courseId,
                    class: classId,
                    date: date,
                    teacher: teacherId, // Assuming teacher is stored in enrollment
                    status: 'Absent', // Mark as absent
                });
                await attendanceEntry.save();
            }
        }

        console.log("Absentees marked successfully.");
    } catch (error) {
        console.error("Error marking absentees:", error);
    }
};

const checkStudentEnrollment = async (studentId, courseId, classId) => {
    // Implement your logic here to check if the student is enrolled in the course/class
    // Example: Query the database for enrollment records
    const enrollment = await Enrollment.findOne({ student: studentId, course: courseId, class: classId });
    return !!enrollment;
};

const getAttendance = async (req, res) => {
    try {
      const { classId, courseId, date } = req.query;
  
      // Validate required fields
      if (!classId || !courseId || !date) {
        return res.status(400).json({ message: "Class ID, Course ID, and Date are required" });
      }
  
      // Validate ObjectIds
      if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(courseId)) {
        return res.status(400).json({ message: "Invalid Class ID or Course ID" });
      }
  
      // Validate date format
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format. Use MM-DD-YYYY" });
      }
  
      // Fetch students enrolled in the specified class and course from Enrollment
      const enrollments = await Enrollment.find({ class: classId, course: courseId }).populate("student");
  
      if (enrollments.length === 0) {
        return res.status(404).json({ message: "No students found for the specified class and course" });
      }
  
      // Extract student IDs
      const studentIds = enrollments.map(enrollment => enrollment.student._id);
  
      // Fetch attendance records for these students on the specified date
      const attendanceRecords = await Attendance.find({
        student: { $in: studentIds },
        class: classId,
        course: courseId,
        date: parsedDate, // Filter by the provided date
      });
  
      // Combine student data with attendance records
      const studentsWithAttendance = enrollments.map(enrollment => {
        const student = enrollment.student;
        const studentAttendance = attendanceRecords.find(record => record.student.equals(student._id));
  
        return {
          studentId: student._id,
          name: student.name,
          reg_No: student.reg_No,
          attendance: studentAttendance
            ? {
                date: studentAttendance.date,
                status: studentAttendance.status, // "present" or "absent"
              }
            : null, // If no attendance record exists for the date
        };
      });
  
      res.status(200).json({ students: studentsWithAttendance });
    } catch (error) {
      console.error("Error fetching students with attendance:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };

  const getStudentAttendance = async (req, res) => {
    try {
        const { studentId, classId, courseId, date } = req.query;

        // Validate required fields
        if (!studentId || !classId || !courseId || !date) {
            return res.status(400).json({ message: "Student ID, Class ID, Course ID, and Date are required" });
        }

        // Validate ObjectIds
        if (
            !mongoose.Types.ObjectId.isValid(studentId) ||
            !mongoose.Types.ObjectId.isValid(classId) ||
            !mongoose.Types.ObjectId.isValid(courseId)
        ) {
            return res.status(400).json({ message: "Invalid Student ID, Class ID, or Course ID" });
        }

        // Validate date format
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
            return res.status(400).json({ message: "Invalid date format. Use MM-DD-YYYY" });
        }

        // Check if the student is enrolled in the specified class and course
        const enrollment = await Enrollment.findOne({
            student: studentId,
            class: classId,
            course: courseId,
        }).populate("student");

        if (!enrollment) {
            return res.status(404).json({ message: "Student not found in the specified class and course" });
        }

        // Fetch attendance record for the student on the specified date
        const attendanceRecord = await Attendance.findOne({
            student: studentId,
            class: classId,
            course: courseId,
            date: parsedDate, // Filter by the provided date
        });

        // Prepare the response
        const studentAttendance = {
            studentId: enrollment.student._id,
            name: enrollment.student.name,
            reg_No: enrollment.student.reg_No,
            attendance: attendanceRecord
                ? {
                      date: attendanceRecord.date,
                      status: attendanceRecord.status, // "present" or "absent"
                  }
                : null, // If no attendance record exists for the date
        };

        res.status(200).json({ student: studentAttendance });
    } catch (error) {
        console.error("Error fetching student attendance:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};


  const exportAttendance = async (req, res) => {
    try {
        const { classId, courseId } = req.query;

        if (!classId || !courseId) {
            return res.status(400).json({ message: "Class ID and Course ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ message: "Invalid Class ID or Course ID" });
        }

        const enrollments = await Enrollment.find({ class: classId, course: courseId }).populate("student");
        if (enrollments.length === 0) {
            return res.status(404).json({ message: "No students found for the specified class and course" });
        }

        const studentIds = enrollments.map(enrollment => enrollment.student._id);

        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            class: classId,
            course: courseId,
        }).populate("student");

        if (attendanceRecords.length === 0) {
            return res.status(404).json({ message: "No attendance records found for the specified class and course" });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        let uniqueDates = [...new Set(attendanceRecords.map(record => record.date.toISOString().split('T')[0]))];
        uniqueDates.sort();

        worksheet.columns = [
            { header: 'Student ID', key: 'studentId', width: 15 },
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Registration Number', key: 'regNo', width: 20 },
            ...uniqueDates.map(date => ({ header: date, key: date, width: 15 }))
        ];

        let studentAttendanceMap = {};
        enrollments.forEach(enrollment => {
            studentAttendanceMap[enrollment.student._id] = {
                studentId: enrollment.student._id,
                name: enrollment.student.name,
                regNo: enrollment.student.reg_No,
            };
            uniqueDates.forEach(date => {
                studentAttendanceMap[enrollment.student._id][date] = 'Absent';
            });
        });

        attendanceRecords.forEach(record => {
            let dateKey = record.date.toISOString().split('T')[0];
            if (studentAttendanceMap[record.student._id]) {
                studentAttendanceMap[record.student._id][dateKey] = record.status;
            }
        });

        Object.values(studentAttendanceMap).forEach(student => {
            worksheet.addRow(student);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting attendance data:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const getLowAttendanceStudents = async (req, res) => {
    try {
        const { classId, courseId } = req.query;

        // Validate required fields
        if (!classId || !courseId) {
            return res.status(400).json({ message: "Class ID and Course ID are required" });
        }

        // Validate ObjectIds
        if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ message: "Invalid Class ID or Course ID" });
        }

        // Fetch students enrolled in the specified class and course from Enrollment
        const enrollments = await Enrollment.find({ class: classId, course: courseId }).populate("student");

        if (enrollments.length === 0) {
            return res.status(404).json({ message: "No students found for the specified class and course" });
        }

        // Extract student IDs
        const studentIds = enrollments.map(enrollment => enrollment.student._id);

        // Fetch all attendance records for these students in the specified course and class
        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            class: classId,
            course: courseId,
        });

        // Calculate attendance percentage for each student
        const studentsWithAttendancePercentage = enrollments.map(enrollment => {
            const student = enrollment.student;
            const studentAttendanceRecords = attendanceRecords.filter(record => record.student.equals(student._id));

            const totalClasses = studentAttendanceRecords.length;
            const presentClasses = studentAttendanceRecords.filter(record => record.status === 'Present').length;

            const attendancePercentage = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 0;

            return {
                studentId: student._id,
                name: student.name,
                reg_No: student.reg_No,
                attendancePercentage: attendancePercentage.toFixed(2), // Round to 2 decimal places
            };
        });

        // Filter students with less than 75% attendance
        const lowAttendanceStudents = studentsWithAttendancePercentage.filter(student => student.attendancePercentage < 75);

        res.status(200).json({ students: lowAttendanceStudents });
    } catch (error) {
        console.error("Error fetching students with low attendance:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
}; 

const sendLowAttendanceEmails = async (req, res) => {
    try {
        const { classId, courseId } = req.body;

        if (!classId || !courseId) {
            return res.status(400).json({ message: "Class ID and Course ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(courseId)) {
            return res.status(400).json({ message: "Invalid Class ID or Course ID" });
        }

        const enrollments = await Enrollment.find({ class: classId, course: courseId })
            .populate("student")
            .populate("course");

        const studentIds = enrollments.map(enrollment => enrollment.student._id);

        const attendanceRecords = await Attendance.find({
            student: { $in: studentIds },
            class: classId,
            course: courseId,
        });

        const lowAttendanceStudents = enrollments.map(enrollment => {
            const student = enrollment.student;
            const course = enrollment.course;
            const studentAttendanceRecords = attendanceRecords.filter(record => record.student.equals(student._id));

            const totalClasses = studentAttendanceRecords.length;
            const presentClasses = studentAttendanceRecords.filter(record => record.status === 'Present').length;

            const attendancePercentage = totalClasses > 0 ? (presentClasses / totalClasses) * 100 : 0;

            return {
                studentId: student._id,
                name: student.name,
                email: student.email,
                reg_No: student.reg_No,
                attendancePercentage: attendancePercentage.toFixed(2),
                courseName: course[0].courseName,
            };
        }).filter(student => student.attendancePercentage < 75);

        if (lowAttendanceStudents.length === 0) {
            return res.status(404).json({ message: "No low-attendance students found" });
        }

        const notificationPromises = lowAttendanceStudents.map(student => {
            const notification = new Notification({
                student: student.studentId,
                message: `Your attendance in ${student.courseName} is ${student.attendancePercentage}%. Please ensure regular attendance.`,
            });

            return notification.save().then(() => {
                // Broadcast the notification via WebSocket
                const notificationMessage = JSON.stringify({
                    studentId: student.studentId,
                    message: notification.message,
                });

                if (wss && wss.clients) {
                    wss.clients.forEach(client => {
                        if (client.readyState === WebSocket.OPEN && client.studentId === student.studentId.toString()) {
                            client.send(notificationMessage);
                        }
                    });
                }
            });
        });

        await Promise.all(notificationPromises);

        res.status(200).json({ status: "success", message: "Notifications sent successfully" });
    } catch (error) {
        console.error("Error sending notifications:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};



const exportStudentAttendance = async (req, res) => {
    try {
        const { classId, courseId, studentId } = req.query;

        if (!classId || !courseId || !studentId) {
            return res.status(400).json({ message: "Class ID, Course ID, and Student ID are required" });
        }

        if (!mongoose.Types.ObjectId.isValid(classId) || !mongoose.Types.ObjectId.isValid(courseId) || !mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: "Invalid Class ID, Course ID, or Student ID" });
        }

        const enrollment = await Enrollment.findOne({ class: classId, course: courseId, student: studentId }).populate("student");
        if (!enrollment) {
            return res.status(404).json({ message: "No student found for the specified class, course, and student ID" });
        }

        const attendanceRecords = await Attendance.find({
            student: studentId,
            class: classId,
            course: courseId,
        }).populate("student");

        if (attendanceRecords.length === 0) {
            return res.status(404).json({ message: "No attendance records found for the specified student, class, and course" });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Attendance');

        let uniqueDates = [...new Set(attendanceRecords.map(record => record.date.toISOString().split('T')[0]))];
        uniqueDates.sort();

        worksheet.columns = [
            { header: 'Student ID', key: 'studentId', width: 15 },
            { header: 'Name', key: 'name', width: 20 },
            { header: 'Registration Number', key: 'regNo', width: 20 },
            ...uniqueDates.map(date => ({ header: date, key: date, width: 15 }))
        ];

        let studentAttendance = {
            studentId: enrollment.student._id,
            name: enrollment.student.name,
            regNo: enrollment.student.reg_No,
        };

        uniqueDates.forEach(date => {
            studentAttendance[date] = 'Absent';
        });

        attendanceRecords.forEach(record => {
            let dateKey = record.date.toISOString().split('T')[0];
            studentAttendance[dateKey] = record.status;
        });

        worksheet.addRow(studentAttendance);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error("Error exporting attendance data:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

module.exports = {takeAttendance , getAttendance , getStudentAttendance , exportAttendance ,getLowAttendanceStudents , sendLowAttendanceEmails , exportStudentAttendance , generateQrCode , takeAttendanceViaQr};

const mongoose = require('mongoose');
// Attendance Schema
const attendanceSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true,
    },
    course: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
    },
    date: {
        type: Date,
        required:true
    },
    status: {
        type: String,
        enum: ['Present', 'Absent'],
        required: true,
        default:'Absent'
    },
    teacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    }
}, { timestamps: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
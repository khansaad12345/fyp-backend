const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: [true, "Student ID is required"],
    },
    course: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Course',
            required: [true, "Course ID is required"],
        }
    ],
    class: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: [true, "Class ID is required"],
    },
    enrollmentDate: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);


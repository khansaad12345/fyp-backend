const mongoose = require('mongoose');
const qrTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true,
    },
    courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
        required: true,
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true,
    },
    date:{
        type:Date,
        required:true
    },
    expiresAt: {
        type: Date,
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model('QrToken', qrTokenSchema);
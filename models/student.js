const mongoose = require('mongoose');
const validator = require("validator");
const bcryptjs = require("bcryptjs");
const { query } = require('express');
const Enrollment = require('./enrollment');

const studentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Please provide the student's name"],
        trim: true,
    },
    email: {
        type: String,
        required: [true, "Please provide the student's email"],
        unique: true,
        validate: [validator.isEmail, "Please provide a valid email"],
    },
    password: {
        type: String,
        required: [true, "Please provide a password"],
        minlength: [8, "Password must be at least 8 characters long"],
    },
    reg_No: {
        type: String,
        required: [true, "Please provide the registration number"],
        unique: true,
        trim: true,
    },
    role: { type: String, default: 'student', enum: ['student'] },
}, { timestamps: true });

studentSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    // Hash the password
    this.password = await bcryptjs.hash(this.password, 10);

    next();
});


studentSchema.methods.correctPassword = async function (password,userPassword) {
    return await bcryptjs.compare(password,userPassword)
}
studentSchema.pre("deleteOne",{document:true,query : false},async function(next) {
    try {
        // const enrollment = await Enrollment.find({student:this._id});
        await Enrollment.deleteOne({student:this._id});
        next()
    } catch (error) {
        next(error)
    }
})

module.exports = mongoose.model('Student', studentSchema);

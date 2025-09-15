const mongoose = require("mongoose");
const validator = require("validator");
const bcryptjs = require("bcryptjs");
const Course = require("./course");

const teacherSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Please provide a Teacher name"],
            trim: true,
            minlength: 3,
            maxlength: 26,
            index: true,
        },
        email: {
            type: String,
            required: [true, "Please provide an email"],
            unique: true,
            validate: [validator.isEmail, "Please provide a valid email"],
        },
        password: {
            type: String,
            required: [true, "Please provide a password"],
            minlength: 8,
            select: false,
        },
        role: { type: String, default: 'teacher', enum: ['teacher'] },
    },
    { timestamps: true }
);

teacherSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    // Hash the password
    this.password = await bcryptjs.hash(this.password, 10);

    next();
});


teacherSchema.methods.correctPassword = async function (password,userPassword) {
    return await bcryptjs.compare(password,userPassword)
}

teacherSchema.pre('findOneAndDelete', { document: false, query: true }, async function (next) {
    const teacherId = this.getQuery()._id; // Access the teacher ID from the query
    console.log('Middleware Triggered for Teacher ID:', teacherId);

    try {
        // Check if the teacher is referenced in the Course schema
        const isReferenced = await Course.exists({ 'classes.teacher': teacherId });
        if (isReferenced) {
            console.log('Teacher is referenced in the Course schema');
            const error = new Error('This teacher is referenced in the Course schema. Please remove the reference before deleting.');
            error.statusCode = 400; // Bad request
            return next(error); // Pass the error to the next middleware
        }

        next(); // Proceed with deletion if no references are found
    } catch (err) {
        console.error('Error in Middleware:', err.message);
        next(err); // Pass unexpected errors to the next middleware
    }
});

const Teacher = mongoose.model("Teacher", teacherSchema);

module.exports = Teacher;


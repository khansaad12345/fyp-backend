const mongoose = require('mongoose');
const Enrollment = require('./enrollment');
const Course = require('./course');

const classSchema = new mongoose.Schema({
    className: { 
        type: String, 
        required: [true, "Please provide the class name"], 
        trim: true,
    },
    classCode: { 
        type: String, 
        required: [true, "Please provide the class code"], 
    },
    shift: { 
        type: String, 
        enum: ['Morning', 'Evening'], // Restrict values to "Morning" or "Evening"
        required: [true, "Please specify the shift"],
    },
    section: { 
        type: String, 
        trim: true,
    },
}, { timestamps: true });

// Add a compound unique index
classSchema.index({ classCode: 1, className: 1, shift: 1, section: 1 }, { unique: true });
classSchema.pre("findOneAndDelete", { document: false, query: true }, async function (next) {
    const classId = this.getQuery()._id; // Access the class ID from the query
    console.log("Middleware Triggered for Class ID:", classId);

    try {
        // Check if the class is referenced in the Enrollment schema
        const enrollmentExists = await Enrollment.exists({ class: classId });
        if (enrollmentExists) {
            return next(
                new Error("This class is referenced in the Enrollment schema. Please remove the reference before deleting.")
            );
        }

        // Check if the class is referenced in the Course schema
        const courseExists = await Course.exists({ "classes.class": classId });
        if (courseExists) {
            return next(
                new Error("This class is referenced in the Course schema. Please remove the reference before deleting.")
            );
        }

        next(); // Proceed with deletion
    } catch (err) {
        console.error("Error in Middleware:", err.message);
        next(err); // Pass unexpected errors to the next middleware
    }
});




module.exports = mongoose.model('Class', classSchema);

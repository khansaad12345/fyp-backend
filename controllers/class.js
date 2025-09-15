const { default: mongoose } = require('mongoose');
const Class = require('../models/class');
const AppError = require('../utils/appError');
const catchAsync = require('../utils/catchAsync');
const CsvParser = require("json2csv").Parser;


const createClass = catchAsync(async (req, res, next) => {
    const { className, classCode, shift, section } = req.body;

    // Validate required fields
    if (!className || !classCode || !shift) {
        return next(new AppError("Class name, class code, and shift are required.", 400));
    }

    // Check for duplicate class based on combination of fields
    const existingClass = await Class.findOne({
        classCode,
        className,
        shift,
        section: section || null, // Handle null section
    });

    if (existingClass) {
        return next(new AppError("A class with the same class code, name, shift, and section already exists.", 409));
    }

    // Create new class
    const newClass = new Class({
        className,
        classCode,
        shift,
        section: section || null, // Set section as null if not provided
    });

    await newClass.save();

    res.status(201).json({
        status: "success",
        message: "Class created successfully.",
        class: newClass,
    });
});

// getting all classes
const getAllClasses = catchAsync(async (req, res, next) => {
    // Extract pagination parameters from the query string
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not provided
    const limit = parseInt(req.query.limit, 10) || 5; // Default to 5 items per page
    const skip = (page - 1) * limit; // Calculate the number of documents to skip

    // Fetch classes sorted by creation date in descending order
    const classes = await Class.find()
        .sort({ createdAt: -1 }) // Sort by createdAt field in descending order
        .skip(skip)
        .limit(limit);

    // Count the total number of classes in the database
    const totalClasses = await Class.countDocuments();

    // Handle case when no classes are found
    if (!classes || classes.length === 0) {
        return next(new AppError("No classes found in the database.", 404));
    }

    const totalPages = Math.ceil(totalClasses / limit);

    res.status(200).json({
        status: "success",
        results: classes.length,
        totalClasses,
        totalPages,
        currentPage: page,
        hasNextPage: page < totalPages, // If there's a next page
        hasPrevPage: page > 1, // If there's a previous page
        classes,
    });
});

// get particular class
const getClass = async (req,res)=>{
    const { id } = req.params;
  
  try {
    // Find the student by ID
    const classId = await Class.findById(id);
  
    if (!classId) {
      return res.status(404).json({ message: 'class not found' });
    }
  
    // Send the student record as a response
    res.status(200).json({ classId });
  } catch (error) {
    console.error('Error fetching class:', error);
    res.status(500).json({ message: 'Failed to fetch class' });
  }
  }

  const updateClass = async (req,res)=>{
    const { id } = req.params;
    const updates = req.body; // The updated fields for the class

    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: 'Invalid class ID' });
        }

        // Find and update the class
        const updatedClass = await Class.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true } // Return the updated document and run validators
        );

        if (!updatedClass) {
            return res.status(404).json({ error: 'Class not found' });
        }

        res.status(200).json({ message: 'Class updated successfully', class: updatedClass });
    } catch (err) {
        console.error('Error updating class:', err.message);
        res.status(500).json({ error: 'An error occurred while updating the class' });
    }
  }

// delete the class 
const deleteClass = async (req,res)=>{
    const classId = req.params.id;

    // Validate class ID
    if (!mongoose.Types.ObjectId.isValid(classId)) {
        return res.status(400).json({ message: "Invalid class ID format." });
    }

    try {
        // Attempt to delete the class
        const deletedClass = await Class.findOneAndDelete({ _id: classId });

        // If no class was deleted, it means it was not found
        if (!deletedClass) {
            return res.status(404).json({ message: "Class not found." });
        }

        res.status(200).json({
            message: "Class deleted successfully.",
            class: deletedClass,
        });
    } catch (error) {
        console.error("Error deleting class record:", error.message);

        // Return the error in a structured format
        res.status(400).json({
            message: error.message || "Failed to delete class record.",
        });
    }
}

// export to excel

const exportClassToExcel = catchAsync(async (req, res, next) => {
    try {
        const classes = await Class.find(); // Ensure this is working and returns data

        if (!classes || classes.length === 0) {
            return next(new AppError("No class found to export.", 404));
        }

        const csvData = classes.map((cls) => ({
            "Class Name": cls.className,
            "Class Code": cls.classCode,
            "shift": cls.shift,
            "Section": cls.section
        }));

        const fields = ["Class Name", "Class Code", "shift", "Section"];
        const csvParser = new CsvParser({ fields });
        const csv = csvParser.parse(csvData);

        res.setHeader("Content-Type", "text/csv");
        res.setHeader("Content-Disposition", "attachment; filename=classData.csv");

        res.status(200).end(csv);
    } catch (error) {
        console.error(error); // Log the error for debugging
        return next(new AppError("Internal server error while exporting classes.", 500));
    }
});

module.exports = { createClass,getAllClasses,deleteClass ,getClass, updateClass,exportClassToExcel};

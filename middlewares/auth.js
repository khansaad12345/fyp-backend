const jwt = require("jsonwebtoken");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Admin = require("../models/admin");
const Teacher = require("../models/teacher");
const Student = require("../models/student"); // Make sure you have the Student model imported
require("dotenv").config();

exports.auth = catchAsync(async (req, res, next) => {
  // Get token from either cookies or headers (Authorization header)
  const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

  if (!token) {
    return next(new AppError("Please login first.", 401)); // Handle case where token is not found
  }

  // Verify token
  const decoded = jwt.verify(token, process.env.SECRETKEY);

  // Determine user type based on decoded role
  let user;
  console.log(decoded.role); // Debugging the role to make sure it is correct

  // Load user based on role
  if (decoded.role === "admin") {
    user = await Admin.findById(decoded.userId);
  } else if (decoded.role === "teacher") {
    user = await Teacher.findById(decoded.userId);
  } else if (decoded.role === "student") {
    user = await Student.findById(decoded.userId); // Ensure you have the Student model
  }

  // Check if user exists
  if (!user) {
    return next(new AppError("The user belonging to this token does not exist.", 401));
  }

  // Attach the user to the request object
  req.user = user;
  next();
});

// Middleware to check if the user's role matches the allowed roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError("You do not have permission to perform this action.", 403));
    }
    next();
  };
};

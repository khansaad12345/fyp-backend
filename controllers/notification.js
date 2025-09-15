// controllers/notificationController.js
const Notification = require('../models/notification');
const mongoose = require("mongoose");

const getStudentNotifications = async (req, res) => {
    try {
        const { studentId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(studentId)) {
            return res.status(400).json({ message: "Invalid Student ID" });
        }

        const notifications = await Notification.find({ student: studentId }).sort({ createdAt: -1 });

        res.status(200).json({ status: "success", notifications });
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const markReadNotification = async (req, res) => {
    try {
      const { notificationId } = req.params;
      await Notification.findByIdAndUpdate(notificationId, { read: true });
      res.status(200).json({ status: "success", message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Internal server error", error: error.message });
    }
  };
  
module.exports = { 
    getStudentNotifications,
    markReadNotification
 };
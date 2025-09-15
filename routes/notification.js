// routes/index.js
const express = require('express');
const router = express.Router();
const { getStudentNotifications, markReadNotification } = require('../controllers/notification');

router.get('/notifications/:studentId', getStudentNotifications);
router.patch("/notifications/mark-as-read/:notificationId", markReadNotification);

module.exports = router;
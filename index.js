const express = require("express");
const http = require("http");
const connectDB = require("./db/connectDB.js");
const authRoutes = require("./routes/auth.js");
const classRoutes = require("./routes/class.js");
const courseRoutes = require("./routes/course.js");
const enrollmentRoutes = require("./routes/enrollment.js");
const attendanceRoutes = require("./routes/attendance.js");
const resultRoutes = require("./routes/result.js");
const notificationRoutes = require("./routes/notification.js");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const wss = require("./websocket");
const globalErrorHandler = require("./controllers/error");
const AppError = require("./utils/appError.js");
require("dotenv").config();

const app = express();
const server = http.createServer(app); // Create an HTTP server
const port = process.env.PORT || 8000;

server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
    });
});

// ✅ Allowed Frontend Origins
const allowedOrigins = [
    "http://localhost:5173",
    "https://cs-it-attendance-portal.netlify.app"
];


app.use(cors({
    origin: allowedOrigins,
    credentials: true, // Allow cookies/session
}));

// ✅ Parse JSON and Cookies
app.use(express.json());
app.use(cookieParser());



// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api", classRoutes);
app.use("/api", courseRoutes);
app.use("/api", enrollmentRoutes);
app.use("/api", attendanceRoutes);

app.use("/api", notificationRoutes);
app.get("/", (req, res) => {
    res.send("Welcome to the home page!");
});

// ✅ Handle 404 Errors
app.all("*", (req, res, next) => {
    next(new AppError(`Can't find ${req.originalUrl} on this server`, 404));
});

//  Global Error Handler
app.use(globalErrorHandler);

// ✅ Start Server
server.listen(port,() => {
    connectDB();
    console.log("Server is running on port", port);
});


module.exports = { server };
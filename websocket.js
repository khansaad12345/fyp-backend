// websocket.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ noServer: true }); // Create WebSocket server without binding it to an HTTP server

wss.on('connection', (ws) => {
    console.log('New client connected');

    ws.on('message', (message) => {
        const data = JSON.parse(message);
        if (data.studentId) {
            ws.studentId = data.studentId; // Associate the connection with a student ID
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

console.log('WebSocket server initialized');
module.exports = wss;
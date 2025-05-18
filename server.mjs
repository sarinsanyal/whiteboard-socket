import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
var dev = process.env.NODE_ENV !== "production";
var hostname = process.env.HOSTNAME || "localhost";
var port = parseInt(process.env.PORT || "3001", 10);
var app = next({ dev: dev, hostname: hostname, port: port });
var handle = app.getRequestHandler();
app.prepare().then(function () {
    var httpServer = createServer(handle);
    var io = new Server(httpServer);
    io.on("connection", function (socket) {
        console.log("User connected: ".concat(socket.id));
        socket.on("join-room", function (_a) {
            var room = _a.room, username = _a.username;
            socket.join(room);
            console.log("User ".concat(username, " joined room ").concat(room));
            socket.to(room).emit("user_joined", "".concat(username, " joined room "));
        });
        socket.on("message", function (_a) {
            var room = _a.room, message = _a.message, sender = _a.sender;
            console.log("Message from ".concat(sender, " in room ").concat(room, ": ").concat(message));
            socket.to(room).emit("message", { roomId: room, sender: sender, content: message });
        });
        socket.on("disconnect", function () {
            var _a = socket.data, username = _a.username, room = _a.room;
            if (username && room) {
                console.log("User ".concat(username, " left room ").concat(room));
                socket.to(room).emit("user_left", "".concat(username, " left the room"));
            }
        });
    });
    httpServer.listen(port, function () {
        console.log("Server running on http://".concat(hostname, ":").concat(port));
    });
});

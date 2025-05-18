import { createServer } from "node:http";
import { Server } from "socket.io";

const port = process.env.PORT || 3001;

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("Socket server is running!");
});

const io = new Server(httpServer, {
  cors: {
  origin: "https://whiteboard-pied.vercel.app",
  methods: ["GET", "POST"],
  credentials: true
}
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-room", ({ room, username }) => {
    socket.join(room);
    console.log(`User ${username} joined room ${room}`);
    socket.to(room).emit("user_joined", `${username} joined room`);
  });

  socket.on("message", ({ room, message, sender }) => {
    console.log(`Message from ${sender} in room ${room}: ${message}`);
    socket.to(room).emit("message", { roomId: room, sender, content: message });
  });

  socket.on("disconnect", () => {
    const { username, room } = socket.data;
    if (username && room) {
      console.log(`User ${username} left room ${room}`);
      socket.to(room).emit("user_left", `${username} left the room`);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}`);
});

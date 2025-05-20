import { createServer } from "node:http";
import { Server } from "socket.io";
import { GoogleGenAI } from "@google/genai"

const port = process.env.PORT || 3001;
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("Socket server is running!");
});

const io = new Server(httpServer, {
  cors: {
    origin: "https://whiteboard-pied.vercel.app",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-room", ({ room, username }) => {
    socket.join(room);
    // Store user info on the socket instance
    socket.data.username = username;
    socket.data.room = room;

    console.log(`User ${username} joined room ${room}`);
    socket.to(room).emit("user_joined", `${username} joined room`);
  });

  socket.on("message", async ({ room, message, sender }) => {
    console.log(`Message from ${sender} in room ${room}: ${message}`);
    socket.to(room).emit("message", { roomId: room, sender, content: message });

    if (message.trim().startsWith("@AI")) {
      const prompt = message.replace("@AI", "").trim();

      try {
        const response = await genAI.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: prompt,
        });
        console.log("AI generated response: ", response);
        io.to(room).emit("message", {
          roomId: room,
          sender: "AI Assistant",
          content: response,
        });
      } catch (error) {
        console.error("Gemini error:", error);
        socket.emit("message", {
          roomId: room,
          sender: "AI Assistant",
          content: "Sorry, I couldn't process that.",
        });
      }
    }
  });

  socket.on("leave-room", ({ room, username }) => {
    socket.leave(room);
    console.log(`User ${username} manually left room ${room}`);
    socket.to(room).emit("user_left", `${username} left the room`);
  });

  socket.on("disconnect", () => {
    const username = socket.data.username;
    const room = socket.data.room;

    if (room && username) {
      console.log(`User ${username} left room ${room}`);
      socket.to(room).emit("user_left", `${username} left the room`);
    } else {
      console.log(`User ${socket.id} disconnected without joining a room.`);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}`);
});

import { createServer } from "node:http";
import { Server } from "socket.io";
import { GoogleGenAI } from "@google/genai"

const port = process.env.PORT || 3001;
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const usersInRooms = {};

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("Socket server is running!");
});

const io = new Server(httpServer, {
  cors: {
    origin: [
      "https://whiteboard-pied.vercel.app",
      "http://localhost:3000"
    ],
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

    if (!usersInRooms[room]) usersInRooms[room] = [];
    if (!usersInRooms[room].includes(username)) {
      usersInRooms[room].push(username);
    }

    console.log(`User ${username} joined room ${room}`);
    socket.to(room).emit("user_joined", `${username} joined room`);
    io.to(room).emit("update-users", usersInRooms[room]);
  });

  socket.on("message", async ({ room, message, sender }) => {
    console.log(`Message from ${sender} in room ${room}: ${message}`);
    socket.to(room).emit("message", { roomId: room, sender, content: message });

    if (message.trim().startsWith("@AI")) {
      const prompt = message.replace("@AI", "").trim();

      try {
        const response = await genAI.models.generateContent({
          model: 'gemini-2.0-flash',
          contents: "In short, give me an answer: " + prompt,
        });

        const textResponse = response.candidates[0].content.parts[0].text;

        io.to(room).emit("message", {
          roomId: room,
          sender: "AI Assistant",
          content: textResponse,
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

  socket.on("code-change", ({ roomId, nickname, code }) => {
    // console.log("Sending code-update to room:", roomId);
    io.to(roomId).emit("code-update", { code });
    console.log(`\n💻 Code change occured in room ${roomId} by user ${nickname}: \n`, code);
  });

  // socket.on("cursor-change", ({ roomId, nickname, position }) => {
	// 	socket.to(roomId).emit("cursor-update", { nickname, position });
	// });

  socket.on("leave-room", ({ room, username }) => {
    socket.leave(room);

    if (usersInRooms[room]) {
      usersInRooms[room] = usersInRooms[room].filter(u => u !== username);
      io.to(room).emit("update-users", usersInRooms[room]);
    }
    console.log(`User ${username} manually left room ${room}`);
    socket.to(room).emit("user_left", `${username} left the room`);
  });

  socket.on("disconnect", () => {
    const username = socket.data.username;
    const room = socket.data.room;

    if (room && username) {
      console.log(`User ${username} left room ${room}`);
      if (usersInRooms[room]) {
        usersInRooms[room] = usersInRooms[room].filter(u => u !== username);
        io.to(room).emit("update-users", usersInRooms[room]);
      }
      socket.to(room).emit("user_left", `${username} left the room`);
    } else {
      console.log(`User ${socket.id} disconnected without joining a room.`);
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}`);
});

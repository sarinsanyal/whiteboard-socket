import { createServer } from "node:http";
import { Server } from "socket.io";
import { GoogleGenAI } from "@google/genai";

const port = process.env.PORT || 3001;
const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const usersInRooms = {};

const httpServer = createServer((req, res) => {
  res.writeHead(200);
  res.end("Socket server is running!");
});

const io = new Server(httpServer, {
  cors: {
    origin: ["https://whiteboard-pied.vercel.app", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("join-room", ({ room, username }) => {
    socket.join(room);
    socket.data = { username, room };

    usersInRooms[room] = usersInRooms[room] || [];
    if (!usersInRooms[room].includes(username)) usersInRooms[room].push(username);

    console.log(`${username} joined Room: ${room}`);
    socket.to(room).emit("user_joined", `${username} joined`);
    io.to(room).emit("update-users", usersInRooms[room]);
    socket.to(room).emit("new-user", { socketId: socket.id, username });
  });

  socket.on("message", async ({ room, message, sender }) => {
    socket.to(room).emit("message", { roomId: room, sender, content: message });
    console.log(`Message from ${sender} in ${room}: ${message}`);

    if (message.trim().startsWith("@AI")) {
      const prompt = message.replace("@AI", "").trim();

      try {
        const response = await genAI.models.generateContent({
          model: "gemini-2.0-flash",
          contents: `In short, give me an answer: ${prompt}`,
        });

        const aiReply = response.candidates?.[0]?.content?.parts?.[0]?.text ||
                        "Sorry, I couldn't understand that.";

        io.to(room).emit("message", {
          roomId: room,
          sender: "AI Assistant",
          content: aiReply,
        });
      } catch (err) {
        console.error("Gemini Error:", err);
        socket.emit("message", {
          roomId: room,
          sender: "AI Assistant",
          content: "Sorry, something went wrong while processing your request.",
        });
      }
    }
  });

  socket.on("code-update", ({ roomId, code }) => {
    socket.to(roomId).emit("code-broadcast", { code });
  });

  socket.on("language-change", ({ roomId, language }) => {
    socket.to(roomId).emit("language-broadcast", { language });
  });

  socket.on("draw", ({ x0, y0, x1, y1, color, roomId, nickname }) => {
    socket.to(roomId).emit("draw", { x0, y0, x1, y1, color, room: roomId, nickname });
  });

  socket.on("clear-canvas", ({ room }) => {
    socket.to(room).emit("clear-canvas", {room});
  });

  socket.on("start-call", ({ roomId }) => {
    socket.to(roomId).emit("user-started-call", { socketId: socket.id });
  });

  socket.on("offer", ({ offer, to }) => {
    io.to(to).emit("offer", { offer, from: socket.id });
  });

  socket.on("answer", ({ answer, to }) => {
    io.to(to).emit("answer", { answer, from: socket.id });
  });

  socket.on("ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("ice-candidate", { candidate, from: socket.id });
  });

  socket.on("stop-call", ({ roomId }) => {
    socket.to(roomId).emit("user-stopped-call", { socketId: socket.id });
  });

  socket.on("leave-room", ({ room, username }) => {
    socket.leave(room);
    if (usersInRooms[room]) {
      usersInRooms[room] = usersInRooms[room].filter(u => u !== username);
      io.to(room).emit("update-users", usersInRooms[room]);
      socket.to(room).emit("user_left", `${username} left the room`);
    }
  });

  socket.on("disconnect", () => {
    const { room, username } = socket.data || {};

    if (room && username && usersInRooms[room]) {
      usersInRooms[room] = usersInRooms[room].filter(u => u !== username);
      io.to(room).emit("update-users", usersInRooms[room]);
      socket.to(room).emit("user_left", `${username} left the room`);
    }

    io.emit("user-disconnected", { socketId: socket.id });
    console.log(`${username || socket.id} disconnected`);
  });
});

httpServer.listen(port, () => {
  console.log(`Socket.IO server running on http://localhost:${port}`);
});

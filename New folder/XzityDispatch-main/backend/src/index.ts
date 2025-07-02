import app from "./app";
import http from "http";
import { Server, Socket } from "socket.io";

const port = Number(process.env.PORT) || 5000;

// Create HTTP server and attach Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL] : []),
    ],
    credentials: true,
  },
});

// Socket.IO chat logic
io.on("connection", (socket: Socket) => {
  socket.on("join_chat", ({ chatId }: { chatId: string | number }) => {
    socket.join(String(chatId));
  });

  socket.on("leave_chat", ({ chatId }: { chatId: string | number }) => {
    socket.leave(String(chatId));
  });

  socket.on("chat_message", (msg: any) => {
    // Optionally: Save to DB here
    io.to(String(msg.chatId)).emit("chat_message", msg);
  });
});

// Start the server
server.listen(port, () => {
  console.log(`🚀 Backend running at http://localhost:${port}`);
});

server.on("error", (err) => {
  console.error("❌ Failed to start server:", err);
});
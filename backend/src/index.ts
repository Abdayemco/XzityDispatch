import app from "./app";
import http from "http";
import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { getRideById } from "./models/ride";
import { saveMessage } from "./models/messageStore";
import { cleanupStuckRides } from "./controllers/ride.controller"; // <-- Add this import

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

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    console.log("AUTH FAIL: No token provided");
    return next(new Error("Auth token required"));
  }
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET!);
    (socket as any).user = user;
    next();
  } catch (err) {
    console.log("AUTH FAIL: Invalid token", err);
    next(new Error("Invalid token"));
  }
});

// Socket.IO chat logic
io.on("connection", (socket: Socket) => {
  const user = (socket as any).user;
  console.log(`SOCKET CONNECT: user=${user?.id} role=${user?.role}`);

  // Join chat: only if user is part of the ride
  socket.on("join_chat", async ({ chatId }: { chatId: string | number }) => {
    const user = (socket as any).user;
    try {
      const ride = await getRideById(chatId);
      console.log(`JOIN_CHAT: user=${user?.id} role=${user?.role} chatId=${chatId} ride=`, ride);
      if (
        ride &&
        (
          String(ride.driverId) === String(user.id) ||
          String(ride.customerId) === String(user.id)
        )
      ) {
        socket.join(String(chatId));
        console.log(`JOINED ROOM: user=${user?.id} joined chatId=${chatId}`);
        socket.emit("join_success", { chatId });
      } else {
        console.log(`JOIN DENIED: user=${user?.id} not in ride ${chatId}`);
        socket.emit("error", "Not authorized to join this chat.");
      }
    } catch (err) {
      console.log(`JOIN ERROR: user=${user?.id} chatId=${chatId} err=`, err);
      socket.emit("error", "Failed to join chat.");
    }
  });

  socket.on("leave_chat", ({ chatId }: { chatId: string | number }) => {
    socket.leave(String(chatId));
    console.log(`LEFT ROOM: user=${user?.id} left chatId=${chatId}`);
  });

  socket.on("chat_message", async (msg: any) => {
    const user = (socket as any).user;
    try {
      const ride = await getRideById(msg.chatId);
      console.log(`MSG: user=${user?.id} chatId=${msg.chatId} content=${msg.content}`);
      if (
        ride &&
        (
          String(ride.driverId) === String(user.id) ||
          String(ride.customerId) === String(user.id)
        )
      ) {
        // Overwrite sender with secure info from JWT
        msg.sender = {
          id: user.id,
          name: user.name,
          role: user.role,
          avatar: user.avatar || "",
        };
        msg.sentAt = new Date().toISOString();
        io.to(String(msg.chatId)).emit("chat_message", msg);
        saveMessage(msg.chatId, msg);
        console.log(`MESSAGE SENT & SAVED: from user=${user?.id} to chatId=${msg.chatId}`);
      } else {
        console.log(`MSG DENIED: user=${user?.id} not in ride ${msg.chatId}`);
        socket.emit("error", "Not authorized to send message to this chat.");
      }
    } catch (err) {
      console.log(`MSG ERROR: user=${user?.id} chatId=${msg.chatId} err=`, err);
      socket.emit("error", "Failed to send chat message.");
    }
  });
});

// Start the server
server.listen(port, () => {
  console.log(`🚀 Backend running at http://localhost:${port}`);
});

// --- Start the cleanup job for stuck rides ---
setInterval(cleanupStuckRides, 5 * 60 * 1000); // runs every 5 minutes

server.on("error", (err) => {
  console.error("❌ Failed to start server:", err);
});
import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler";
import authRoutes from "./routes/auth.routes";
import rideRoutes from "./routes/ride.routes";
import testRoutes from "./routes/test.routes";
import adminRoutes from "./routes/admin.routes";
import contactRouter from "./routes/contact";
import chatRoutes from "./routes/chat";
import jwt from "jsonwebtoken";

const app = express();

// Parse JSON bodies BEFORE any route handlers
app.use(express.json());

// --- CORS: Allow Vite dev server, .env CLIENT_URL, and production domains ---
const allowedOrigins = [
  "http://localhost:5173",
  "https://www.xzity.com",
  "https://xzity.com"
];
if (process.env.CLIENT_URL && !allowedOrigins.includes(process.env.CLIENT_URL)) {
  allowedOrigins.push(process.env.CLIENT_URL);
}
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Optional: Basic request logger (for debugging)
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// --- JWT AUTH HEADER PARSER (GLOBAL) ---
app.use((req: any, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      req.user = decoded;
    } catch (err) {
      req.user = undefined;
    }
  }
  next();
});

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", contactRouter);
app.use("/api", chatRoutes);
app.use("/test", testRoutes);

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler (should be last)
app.use(errorHandler);

export default app;
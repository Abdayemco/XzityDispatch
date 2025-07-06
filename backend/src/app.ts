import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler";
import authRoutes from "./routes/auth.routes";
import rideRoutes from "./routes/ride.routes";
import testRoutes from "./routes/test.routes";
import adminRoutes from "./routes/admin.routes"; // <-- Updated import
import contactRouter from "./routes/contact";
import chatRoutes from "./routes/chat";

const app = express();

// Parse JSON bodies BEFORE any route handlers
app.use(express.json());

// Allow CORS from Vite dev server and optional .env CLIENT_URL
const allowedOrigins = [
  "http://localhost:5173",
];
if (process.env.CLIENT_URL) {
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
// This middleware will decode the JWT from the Authorization header and add req.user for downstream handlers
import jwt from "jsonwebtoken";
app.use((req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      // Attach user info to req.user for downstream
      req.user = decoded;
    } catch (err) {
      // Invalid token: do not set req.user, let protected routes handle 401
      req.user = undefined;
    }
  }
  next();
});

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/admin", adminRoutes); // <-- Admin routes
app.use("/api", contactRouter);      // Contact router under /api ([POST] /api/contact-admin)
app.use("/api", chatRoutes);
app.use("/test", testRoutes);

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler (should be last)
app.use(errorHandler);

export default app;
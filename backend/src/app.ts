import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler";
import authRoutes from "./routes/auth.routes";
import rideRoutes from "./routes/ride.routes";
import testRoutes from "./routes/test.routes";
import adminRoutes from "./routes/admin";
import contactRouter from "./routes/contact";
import chatRoutes from "./routes/chat"; // <-- Add this line

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

// Register routes
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", contactRouter); // Contact router under /api ([POST] /api/contact-admin)
app.use("/api", chatRoutes); // <-- Add this line
app.use("/test", testRoutes);

// 404 handler for undefined routes
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler (should be last)
app.use(errorHandler);

export default app;
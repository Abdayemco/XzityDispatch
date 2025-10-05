import express from "express";
import cors from "cors";
import { errorHandler } from "./middlewares/errorHandler";
import authRoutes from "./routes/auth.routes";
import rideRoutes from "./routes/ride.routes";
import testRoutes from "./routes/test.routes";
import adminRoutes from "./routes/admin.routes";
import contactRouter from "./routes/contact";
import chatRoutes from "./routes/chat";
import driverRoutes from "./routes/driver.routes";
import familyRoutes from "./routes/family.routes";
import businessRoutes from "./routes/business.routes";
import jwt from "jsonwebtoken";

const app = express();

// --- CORS middleware (ALWAYS FIRST) ---
const allowedOrigins = [
  "http://localhost:5173",
  "https://www.xzity.com",
  "https://xzity.com",
];
if (process.env.CLIENT_URL && !allowedOrigins.includes(process.env.CLIENT_URL)) {
  allowedOrigins.push(process.env.CLIENT_URL);
}
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// Handle preflight requests for all routes.
app.options("*", cors({
  origin: allowedOrigins,
  credentials: true,
}));

// --- BODY PARSER (MUST BE BEFORE ROUTES!) ---
app.use(express.json());

// --- DEBUG: Log RAW BODY for /api/rides/request ---
app.use((req, res, next) => {
  if (req.method === "POST" && req.originalUrl.startsWith("/api/rides/request")) {
    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      if (raw) {
        console.log("RAW BODY DATA:", raw);
      }
      // Don't call next() here, must always call it outside for all requests
    });
    // Don't return early, let next() run
  }
  next();
});

// Request logging
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});

// JWT authentication decoding middleware
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

// --- ROUTES ---
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/families", familyRoutes);
app.use("/api/businesses", businessRoutes);
app.use("/api", contactRouter);
app.use("/api", chatRoutes);
app.use("/test", testRoutes);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use(errorHandler);

export default app;
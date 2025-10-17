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
import familyRoutes from "./routes/family";              // <- use ./'family'
import familyMemberRoutes from "./routes/familyMember";   // <- use ./'familyMember'
import trackingRoutes from "./routes/tracking.routes";
import jwt from "jsonwebtoken";

const app = express();

// CORS setup - always first!
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
    origin: function (origin, callback) {
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

app.options("*", cors({
  origin: allowedOrigins,
  credentials: true,
}));

app.use(express.json());

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
      console.log("Decoded JWT user:", req.user); // Debug log
    } catch (err) {
      req.user = undefined;
      console.log("JWT decode error:", err);
    }
  } else {
    req.user = undefined;
  }
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/rides", rideRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/driver", driverRoutes);
app.use("/api/families", familyRoutes);          // <--- use this for group CRUD
app.use("/api/families", familyMemberRoutes);    // <--- use this for group member management
app.use("/api", contactRouter);
app.use("/api", chatRoutes);
app.use("/api", trackingRoutes);                 // <--- tracking for both types
app.use("/test", testRoutes);

app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

app.use(errorHandler);

export default app;
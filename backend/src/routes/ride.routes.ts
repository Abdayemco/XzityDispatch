import { Router, Request, Response, NextFunction } from "express";
import {
  getAvailableRides,
  acceptRide,
  requestRide,
} from "../controllers/ride.controller";

const router = Router();

// Logging middleware for debugging
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// GET /api/rides/available?vehicleType=car
router.get("/available", getAvailableRides);

// POST /api/rides/request
router.post("/request", (req, res, next) => {
  // Convert customerId to number if it exists and is a string (defensive)
  if (req.body && typeof req.body.customerId === "string" && !isNaN(Number(req.body.customerId))) {
    req.body.customerId = Number(req.body.customerId);
  }
  console.log("Received data on /api/rides/request:", req.body);
  return requestRide(req, res, next);
});

// PUT /api/rides/:rideId/accept
router.put("/:rideId/accept", acceptRide);

export default router;
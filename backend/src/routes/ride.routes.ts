import { Router, Request, Response, NextFunction } from "express";
import {
  getAvailableRides,
  acceptRide,
  requestRide,
  getRideStatus,
} from "../controllers/ride.controller";
import { prisma } from "../utils/prisma";
import { RideStatus } from "@prisma/client";

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

// GET /api/rides/:rideId/status
router.get("/:rideId/status", getRideStatus);

// PUT /api/rides/:rideId/cancel
router.put("/:rideId/cancel", async (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  if (isNaN(rideId)) return res.status(400).json({ error: "Invalid rideId" });
  try {
    const ride = await prisma.ride.update({
      where: { id: rideId },
      data: { status: { set: RideStatus.CANCELLED } },
    });
    res.json({ status: "CANCELLED", ride });
  } catch (error) {
    res.status(400).json({ error: "Could not cancel ride" });
  }
});

// PUT /api/rides/:rideId/done
router.put("/:rideId/done", async (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  if (isNaN(rideId)) return res.status(400).json({ error: "Invalid rideId" });
  try {
    const ride = await prisma.ride.update({
      where: { id: rideId },
      data: { status: { set: RideStatus.COMPLETED } },
    });
    res.json({ status: "DONE", ride }); // You can keep "DONE" for the frontend, but DB uses COMPLETED
  } catch (error) {
    res.status(400).json({ error: "Could not mark ride as done" });
  }
});

export default router;
import { Router } from "express";
import {
  getAvailableRides,
  acceptRide,
  requestRide,
} from "../controllers/ride.controller";

const router = Router();

// GET /api/rides/available?vehicleType=car
router.get("/available", getAvailableRides);

// POST /api/rides/request
router.post("/request", requestRide);

// PUT /api/rides/:rideId/accept
router.put("/:rideId/accept", acceptRide);

export default router;
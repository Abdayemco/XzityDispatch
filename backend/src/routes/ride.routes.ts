import { Router } from "express";
import {
  requestRide,
  getAvailableRides,
  acceptRide,
  startRide,
  getRideStatus,
  rateRide,
  getCurrentRide,
  markRideAsDone,
  cancelRide,
} from "../controllers/ride.controller";
import { checkUserStatus } from "../middlewares/checkUserStatus";

const router = Router();

// Customer requests a ride
router.post("/request", requestRide);

// Get available rides for drivers
router.get("/available", getAvailableRides);

// Driver accepts a ride
router.put("/:rideId/accept", acceptRide);

// Driver starts a ride
router.put("/:rideId/start", startRide);

// Get ride status (for polling)
router.get("/:rideId/status", getRideStatus);

// Customer rates a ride
router.post("/:rideId/rate", rateRide);

// Get current ride for logged-in customer or driver
router.get("/current", checkUserStatus, getCurrentRide);

// Mark ride as done (completed)
router.put("/:rideId/done", checkUserStatus, markRideAsDone);

// Cancel a ride
router.put("/:rideId/cancel", checkUserStatus, cancelRide);

export default router;
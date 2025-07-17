import { Router } from "express";
import {
  requestRide,
  getAvailableRides,
  acceptRide,
  startRide,
  markRideNoShow,
  getRideStatus,
  rateRide,
  getCurrentRide,
  markRideAsDone,
  cancelRide,
} from "../controllers/ride.controller";
import { checkUserStatus } from "../middlewares/checkUserStatus";

const router = Router();

// Create a new ride (regular or scheduled)
router.post("/schedule", checkUserStatus, requestRide);

// Get available rides for driver (including scheduled)
router.get("/available", checkUserStatus, getAvailableRides);

// Driver accepts a ride (pending or scheduled)
router.put("/:rideId/accept", checkUserStatus, acceptRide);

// Driver starts a ride
router.put("/:rideId/start", checkUserStatus, startRide);

// Driver marks scheduled ride as "No Show"
router.put("/:rideId/no_show", checkUserStatus, markRideNoShow);

// Get ride status for polling
router.get("/:rideId/status", checkUserStatus, getRideStatus);

// Customer rates ride
router.post("/:rideId/rate", checkUserStatus, rateRide);

// Get current ride for logged-in customer or driver
router.get("/current", checkUserStatus, getCurrentRide);

// Mark ride as completed
router.put("/:rideId/done", checkUserStatus, markRideAsDone);

// Cancel ride
router.put("/:rideId/cancel", checkUserStatus, cancelRide);

export default router;
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

/**
 * CUSTOMER ROUTES
 */

// Create a new ride (regular or scheduled)
router.post("/schedule", checkUserStatus, requestRide);
router.post("/request", checkUserStatus, requestRide);
// Optionally allow POST /api/rides as well
// router.post("/", checkUserStatus, requestRide);

// Get the customer's (or driver's) current active ride
router.get("/current", checkUserStatus, getCurrentRide);

// Get ride status for polling
router.get("/:rideId/status", checkUserStatus, getRideStatus);

// Customer rates ride
router.post("/:rideId/rate", checkUserStatus, rateRide);

// Customer marks ride as done (i.e., completed)
router.put("/:rideId/done", checkUserStatus, markRideAsDone);

// Customer cancels ride
router.put("/:rideId/cancel", checkUserStatus, cancelRide);

/**
 * DRIVER ROUTES
 */

// Get available rides for driver (including scheduled)
router.get("/available", checkUserStatus, getAvailableRides);

// Driver accepts a ride (pending or scheduled)
router.put("/:rideId/accept", checkUserStatus, acceptRide);

// Driver starts a ride
router.put("/:rideId/start", checkUserStatus, startRide);

// Driver marks scheduled ride as "No Show"
router.put("/:rideId/no_show", checkUserStatus, markRideNoShow);

export default router;
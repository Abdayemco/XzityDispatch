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
  editScheduledRide,
  getAllCustomerRides,
} from "../controllers/ride.controller";
import { checkUserStatus } from "../middlewares/checkUserStatus";

const router = Router();

/**
 * CUSTOMER ROUTES
 */

// Create a new ride (regular or scheduled)
router.post("/schedule", checkUserStatus, requestRide);
router.post("/request", checkUserStatus, requestRide);

// Edit scheduled ride
router.put("/schedule/:rideId", checkUserStatus, editScheduledRide);

// Get all rides for a customer (scheduled, active, done, except cancelled)
router.get("/all", checkUserStatus, getAllCustomerRides);

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
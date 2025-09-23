import { Router } from "express";
import {
  requestRide,
  getAvailableRides,
  getAvailableRequests,
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
  getAllDriverRides,
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

// NEW: Get all rides for a driver (scheduled, active, done, cancelled)
router.get("/all-driver", checkUserStatus, getAllDriverRides);

// Driver accepts a ride (pending or scheduled)
router.put("/:rideId/accept", checkUserStatus, acceptRide);

// Driver starts a ride
router.put("/:rideId/start", checkUserStatus, startRide);

// Driver marks scheduled ride as "No Show"
router.put("/:rideId/no_show", checkUserStatus, markRideNoShow);

/**
 * PROVIDER ROUTES (DRIVER, SHOPPER, HAIR_DRESSER, INSTITUTE)
 */

// NEW: Get available requests for any provider type (use providerId & role)
router.get("/available-requests", checkUserStatus, getAvailableRequests);

export default router;
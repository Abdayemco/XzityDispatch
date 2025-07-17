import { Router } from "express";
import {
  updateLocationStatus,
  getAvailableRides,
  acceptRide,
  startRide,
  markRideNoShow,
  getCurrentRide,
} from "../controllers/driver.controller";
import { checkUserStatus } from "../middlewares/checkUserStatus";

const router = Router();

// Update driver's location and status
router.post("/location", checkUserStatus, updateLocationStatus);

// Get available rides for driver (including scheduled)
router.get("/rides/available", checkUserStatus, getAvailableRides);

// Driver accepts a ride (pending or scheduled)
router.put("/rides/:rideId/accept", checkUserStatus, acceptRide);

// Driver starts a ride
router.put("/rides/:rideId/start", checkUserStatus, startRide);

// Driver marks scheduled ride as "No Show"
router.put("/rides/:rideId/no_show", checkUserStatus, markRideNoShow);

// Get current ride for logged-in driver
router.get("/rides/current", checkUserStatus, getCurrentRide);

export default router;
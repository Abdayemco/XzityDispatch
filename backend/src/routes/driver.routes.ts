import { Router } from "express";
import { updateLocationStatus } from "../controllers/driver.controller";
import { isDriver } from "../middleware/auth"; // Your JWT middleware

const router = Router();

// POST /api/driver/location
router.post("/location", isDriver, updateLocationStatus);

export default router;
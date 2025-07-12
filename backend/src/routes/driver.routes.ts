import { Router } from "express";
import { updateLocationStatus } from "../controllers/driver.controller";

const router = Router();

// POST /api/driver/location
router.post("/location", updateLocationStatus);

export default router;
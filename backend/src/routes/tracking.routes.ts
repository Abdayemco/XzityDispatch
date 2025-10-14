import { Router } from "express";
import { getFamilyLocations, getBusinessLocations } from "../controllers/tracking.controller";
import { authGroupAdmin } from "../middleware/authGroupAdmin";

const router = Router();

// Only family admins can view family tracking
router.get("/family/:familyId/locations", authGroupAdmin("family"), getFamilyLocations);

// Only business admins can view business tracking
router.get("/business/:businessId/locations", authGroupAdmin("business"), getBusinessLocations);

export default router;
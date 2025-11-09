import { Router } from "express";
import { getRoles, getVehicleTypes, getRideStatuses } from "../controllers/enums.controller";

const router = Router();

router.get("/roles", getRoles);
router.get("/vehicle-types", getVehicleTypes);
router.get("/ride-statuses", getRideStatuses);

export default router;
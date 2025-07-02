import { Router } from "express";
import {
  getDrivers,
  getDriver,
  updateDriverSubscription,
  getCustomers,
  blockCustomer,
  getRides
} from "../controllers/admin.controller";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

router.use(requireAdmin);

router.get("/drivers", getDrivers);
router.get("/drivers/:id", getDriver);
router.patch("/drivers/:id/subscription", updateDriverSubscription);

// New customer endpoints
router.get("/customers", getCustomers);
router.patch("/customers/:id/block", blockCustomer);

// New rides endpoint
router.get("/rides", getRides);

export default router;
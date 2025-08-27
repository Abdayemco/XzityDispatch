import { Router } from "express";
import {
  createBusiness,
  inviteEmployee,
  verifyEmployee,
  listEmployees,
  removeEmployee
} from "../controllers/business.controller";

const router = Router();

router.post("/", createBusiness);
router.post("/:businessId/invite", inviteEmployee);
router.post("/:businessId/verify", verifyEmployee);
router.get("/:businessId/employees", listEmployees);
router.delete("/:businessId/employees/:userRoleId", removeEmployee);

export default router;
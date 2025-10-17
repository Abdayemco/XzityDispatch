import { Router } from "express";
import {
  listFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  acceptFamilyInvite // <-- Import the new controller
} from "../controllers/familyMemberController";
import authenticate from "../middlewares/authenticate"; // Your auth middleware

const router = Router();

// All member management endpoints (protected)
router.use(authenticate);

router.get("/:familyId/members", listFamilyMembers);
router.post("/:familyId/members", addFamilyMember);
router.patch("/user-roles/:id", updateFamilyMember);
router.delete("/user-roles/:id", deleteFamilyMember);

// Add the invite acceptance endpoint (public or protected, depending on your needs)
router.post("/invite/accept", acceptFamilyInvite);

export default router;
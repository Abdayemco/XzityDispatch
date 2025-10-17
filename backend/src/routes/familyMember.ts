import { Router } from "express";
import {
  listFamilyMembers,
  addFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
} from "../controllers/familyMemberController";
import authenticate from "../middlewares/authenticate"; // Your JWT/auth middleware

const router = Router();

router.use(authenticate);

// List members in a family
router.get("/:familyId/members", listFamilyMembers);

// Add member to a family
router.post("/:familyId/members", addFamilyMember);

// Edit member info
router.patch("/user-roles/:id", updateFamilyMember);

// Delete member
router.delete("/user-roles/:id", deleteFamilyMember);

export default router;
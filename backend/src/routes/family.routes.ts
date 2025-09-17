import { Router } from "express";
import {
  createFamily,
  inviteFamilyMember,
  verifyFamilyMember,
  listFamilyGroups,
  listFamilyMembers,
  removeFamilyMember
} from "../controllers/family.controller";

const router = Router();

// List all family groups for a user (NEW)
router.get("/", listFamilyGroups);

router.post("/", createFamily);
router.post("/:familyId/invite", inviteFamilyMember);
router.post("/:familyId/verify", verifyFamilyMember);
router.get("/:familyId/members", listFamilyMembers);
router.delete("/:familyId/members/:userRoleId", removeFamilyMember);

export default router;
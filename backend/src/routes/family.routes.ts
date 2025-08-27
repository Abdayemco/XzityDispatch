import { Router } from "express";
import {
  createFamily,
  inviteFamilyMember,
  verifyFamilyMember,
  listFamilyMembers,
  removeFamilyMember
} from "../controllers/family.controller";

const router = Router();

router.post("/", createFamily);
router.post("/:familyId/invite", inviteFamilyMember);
router.post("/:familyId/verify", verifyFamilyMember);
router.get("/:familyId/members", listFamilyMembers);
router.delete("/:familyId/members/:userRoleId", removeFamilyMember);

export default router;
import { Router } from "express";
import {
  getFamilies,
  createFamily,
  updateFamily,
  deleteFamily,
} from "../controllers/familyController";
import authenticate from "../middlewares/authenticate"; // Or your JWT/auth middleware

const router = Router();

router.use(authenticate);

router.get("/", getFamilies);
router.post("/", createFamily);
router.patch("/:id", updateFamily);
router.delete("/:id", deleteFamily);

export default router;
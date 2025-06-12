import { Router } from "express";
import { register, login, verifyCode } from "../controllers/auth.controller";

const router = Router();
router.post("/register", register);
router.post("/login", login);
router.post("/verify", verifyCode);

export default router;
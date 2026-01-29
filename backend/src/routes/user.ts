import { Router } from "express";
import { updateMainProviderCategory } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// PATCH /users/:id/main-provider-category with authentication
router.patch("/:id/main-provider-category", authMiddleware, updateMainProviderCategory);

export default router;
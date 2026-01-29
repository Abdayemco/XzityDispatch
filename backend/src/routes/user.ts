import { Router } from "express";
import { updateMainProviderCategory } from "../controllers/user.controller";
import authenticate from "../middlewares/authenticate";

const router = Router();

router.patch("/:id/main-provider-category", authenticate, updateMainProviderCategory);

export default router;
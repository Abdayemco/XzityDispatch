import { Router } from "express";
import * as chatController from "../controllers/chat.controller";

const router = Router();

// Get all messages for a ride's chat
router.get("/rides/:rideId/chat/messages", chatController.getMessages);

// Send a new message in a ride's chat
router.post("/rides/:rideId/chat/message", chatController.sendMessage);

export default router;
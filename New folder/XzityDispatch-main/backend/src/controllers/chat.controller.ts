import { Request, Response } from "express";
import * as chatService from "../services/chat.service";

// Get all messages for a ride's chat
export const getMessages = async (req: Request, res: Response) => {
  try {
    const rideId = Number(req.params.rideId);
    if (isNaN(rideId)) return res.status(400).json({ error: "Invalid rideId" });

    const chat = await chatService.getOrCreateChatByRide(rideId);
    const messages = await chatService.getMessages(chat.id);
    res.json(messages);
  } catch (e) {
    res.status(500).json({ error: "Failed to get messages" });
  }
};

// Send a new message in a ride's chat
export const sendMessage = async (req: Request, res: Response) => {
  try {
    const rideId = Number(req.params.rideId);
    const { senderId, content } = req.body;
    if (isNaN(rideId) || !senderId || !content) {
      return res.status(400).json({ error: "rideId, senderId, and content are required" });
    }

    const chat = await chatService.getOrCreateChatByRide(rideId);
    const message = await chatService.createMessage(chat.id, senderId, content);
    res.json(message);
  } catch (e) {
    res.status(500).json({ error: "Failed to send message" });
  }
};
import { Request, Response } from "express";
import {
  getOrCreateChatByRide,
  getMessages as getDbMessages,
  createMessage,
} from "../services/chat.service";

// Get all messages for a ride's chat
export const getMessages = async (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  try {
    const chat = await getOrCreateChatByRide(rideId); // Ensure chat exists for this ride
    const messages = await getDbMessages(chat.id); // Get messages by chatId, should include sender info
    // Respond with messages as array of {id, content, sender: {id, name, role}, sentAt}
    res.json(
      messages.map((m: any) => ({
        id: m.id,
        content: m.content,
        sender: m.sender
          ? {
              id: m.sender.id,
              name: m.sender.name,
              role: m.sender.role,
              avatar: m.sender.avatar || "",
            }
          : null,
        sentAt: m.sentAt,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: "Failed to get messages" });
  }
};

// Send a new message in a ride's chat
export const sendMessage = async (req: Request, res: Response) => {
  const rideId = Number(req.params.rideId);
  // Accept both {senderId, content} and {sender: {id}, content}
  let senderId = req.body.senderId;
  const { content } = req.body;
  if (!senderId && req.body.sender && req.body.sender.id) {
    senderId = req.body.sender.id;
  }
  if (!senderId || !content) {
    return res.status(400).json({ error: "senderId and content are required" });
  }
  try {
    const chat = await getOrCreateChatByRide(rideId);
    const message = await createMessage(chat.id, senderId, content); // Save in the real DB
    // Respond with message including sender object
    res.status(201).json({
      id: message.id,
      content: message.content,
      sender: message.sender
        ? {
            id: message.sender.id,
            name: message.sender.name,
            role: message.sender.role,
            avatar: message.sender.avatar || "",
          }
        : null,
      sentAt: message.sentAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to send message" });
  }
};
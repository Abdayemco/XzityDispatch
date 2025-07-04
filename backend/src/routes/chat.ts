import express from "express";
const router = express.Router();

const messages: Record<string, any[]> = {}; // in-memory, replace with DB in prod

router.get("/rides/:rideId/chat/messages", (req, res) => {
  const rideId = req.params.rideId;
  res.json(messages[rideId] || []);
});

router.post("/rides/:rideId/chat/messages", (req, res) => {
  const rideId = req.params.rideId;
  const { sender, content } = req.body;
  if (!messages[rideId]) messages[rideId] = [];
  const msg = {
    id: Date.now() + Math.random(),
    sender,
    content,
    sentAt: new Date().toISOString(),
  };
  messages[rideId].push(msg);
  res.status(201).json(msg);
});

export default router;
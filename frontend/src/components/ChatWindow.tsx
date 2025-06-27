import React, { useState, useEffect } from "react";
import axios from "axios";

interface Message {
  id: number;
  sender: { id: number; name: string };
  content: string;
  sentAt: string;
}

interface ChatWindowProps {
  rideId: number;
  senderId: number;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ rideId, senderId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  // Fetch messages on mount and every 3 seconds
  useEffect(() => {
    let isMounted = true;
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`/api/rides/${rideId}/chat/messages`);
        if (isMounted) setMessages(res.data);
      } catch (e) {
        // Handle error
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [rideId]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setLoading(true);
    try {
      await axios.post(`/api/rides/${rideId}/chat/message`, {
        senderId,
        content,
      });
      setContent("");
      // Message will appear on next poll
    } catch (e) {
      // Handle error
    }
    setLoading(false);
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 16, maxWidth: 400 }}>
      <div style={{ maxHeight: 200, overflowY: "auto", marginBottom: 8 }}>
        {messages.map((msg) => (
          <div key={msg.id}>
            <strong>{msg.sender?.name ?? "User"}:</strong> {msg.content}{" "}
            <small>{new Date(msg.sentAt).toLocaleTimeString()}</small>
          </div>
        ))}
      </div>
      <form onSubmit={sendMessage} style={{ display: "flex", gap: 4 }}>
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type your message"
          style={{ flex: 1 }}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !content.trim()}>
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;
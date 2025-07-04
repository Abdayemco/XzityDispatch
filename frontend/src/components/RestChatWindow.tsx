import React, { useEffect, useState, useRef } from "react";
import axios from "axios";

/**
 * A simple REST polling chat window component.
 * @param {string|number} rideId - The ride/chat room ID.
 * @param {object} sender - The current user sending messages.
 */
export default function RestChatWindow({ rideId, sender, messages: messagesProp, onSend, style }) {
  const [messages, setMessages] = useState(messagesProp || []);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  // If parent manages messages (optional), sync them
  useEffect(() => {
    if (Array.isArray(messagesProp)) setMessages(messagesProp);
  }, [messagesProp]);

  // Poll for messages every 3 seconds, or fetch once if prop not present
  useEffect(() => {
    if (messagesProp) return; // Parent manages messages, skip polling here
    let cancelled = false;
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`/api/rides/${rideId}/chat/messages`);
        if (!cancelled) setMessages(res.data || []);
      } catch {
        if (!cancelled) setMessages([]);
      }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rideId, messagesProp]);

  // Scroll to bottom on new message
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    let sent = false;
    if (typeof onSend === "function") {
      await onSend(input);
      sent = true;
    } else {
      try {
        await axios.post(`/api/rides/${rideId}/chat/messages`, {
          sender,
          content: input,
        });
        sent = true;
      } catch {}
    }
    if (sent) setInput("");
  };

  return (
    <div style={{ ...style, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, minHeight: 200, overflowY: "auto", border: "1px solid #ccc", padding: 8, background: "#fafbfc" }}>
        {messages && messages.length > 0 ? messages.map((m) => (
          <div key={m.id || `${m.senderId || ""}-${m.timestamp || ""}-${Math.random()}`}>
            <b style={{ color: m.sender?.role === "driver" ? "#1976D2" : "#388e3c" }}>
              {m.sender?.name || "User"}:
            </b>{" "}
            {m.content}
          </div>
        )) : (
          <div style={{ color: "#aaa", textAlign: "center" }}>No messages yet.</div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={send} style={{ display: "flex", marginTop: 4 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{ flex: 1, marginRight: 8, padding: "0.5em" }}
          placeholder="Type a message..."
        />
        <button type="submit" style={{ padding: "0.5em 1.4em" }}>Send</button>
      </form>
    </div>
  );
}
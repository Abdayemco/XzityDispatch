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

  // Optional: clear input when rideId changes (for reconnection/user switch)
  useEffect(() => {
    setInput("");
  }, [rideId]);

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
          sender: {
            id: sender.id,
            name: sender.name,
            role: sender.role,
            avatar: sender.avatar || "",
          },
          content: input,
        });
        sent = true;
      } catch {}
    }
    if (sent) setInput("");
  };

  // Helper to display "Driver", "Customer", or fallback name
  function senderLabel(m) {
    if (m?.sender?.role === "driver") return "Driver";
    if (m?.sender?.role === "customer") return "Customer";
    if (m?.sender?.name) return m.sender.name;
    return "User";
  }

  // Helper for chat bubble style
  function bubbleStyle(m) {
    if (m?.sender?.role === "driver")
      return { background: "#e3f2fd", color: "#1976D2", fontWeight: "bold", borderRadius: 16, padding: "16px 9px", display: "inline-block" };
    if (m?.sender?.role === "customer")
      return { background: "#e8f5e9", color: "#388e3c", fontWeight: "bold", borderRadius: 16, padding: "16px 8px", display: "inline-block" };
    return { background: "#eee", color: "#444", borderRadius: 16, padding: "8px 16px", display: "inline-block" };
  }

  // Helper for alignment
  function messageAlign(m) {
    if (m?.sender?.role === "driver") return { justifyContent: "flex-end" };
    if (m?.sender?.role === "customer") return { justifyContent: "flex-start" };
    return { justifyContent: "flex-start" };
  }

  return (
    <div style={{ ...style, display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, minHeight: 200, overflowY: "auto", border: "1px solid #ccc", padding: 8, background: "#fafbfc" }}>
        {messages && messages.length > 0 ? messages.map((m, idx) => (
          <div
            key={m.id || `${m.sender?.id || ""}-${m.sentAt || ""}-${idx}`}
            style={{ display: "flex", ...messageAlign(m), marginBottom: 8 }}
          >
            <div style={bubbleStyle(m)}>
              <span>
                {senderLabel(m)}:
              </span>{" "}
              {m.content}
              <span style={{ color: "#999", fontSize: "0.8em", marginLeft: 8 }}>
                {m.sentAt ? new Date(m.sentAt).toLocaleTimeString() : ""}
              </span>
            </div>
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
          autoComplete="off"
        />
        <button type="submit" style={{ padding: "0.5em 1.4em" }}>Send</button>
      </form>
    </div>
  );
}
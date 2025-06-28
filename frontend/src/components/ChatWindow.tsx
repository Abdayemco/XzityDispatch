import React, { useEffect, useRef, useState } from "react";

// Helper: fallback to initials if no avatar
const getInitials = (name = "") =>
  name
    .split(" ")
    .map((n) => n[0]?.toUpperCase())
    .join("")
    .slice(0, 2);

// Helper: friendly timestamp
function formatTimestamp(iso: string | Date) {
  const date = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
  return date.toLocaleString();
}

/**
 * messages: [
 *   {
 *     id, content, sentAt,
 *     sender: { id, name, avatar, role }
 *   }
 * ]
 * currentUserId: number
 * onSend: function (optional): called with (text) when user submits message
 * style: (optional) object, can set height/width.
 */
export default function ChatWindow({
  messages = [],
  currentUserId,
  onSend, // function (optional)
  style = {}
}) {
  // Defensive: filter out falsy, and ensure each message has id, sender, and fallback sender fields
  const safeMessages = Array.isArray(messages)
    ? messages
        .filter(Boolean)
        .map((m, idx) => ({
          ...m,
          id: m?.id ?? m?._id ?? m?.timestamp ?? `${Date.now()}_${idx}`,
          sender: m?.sender ?? {
            id: m?.senderId ?? "unknown",
            name: m?.senderName ?? "User",
            role: m?.senderRole ?? "user",
            avatar: m?.senderAvatar ?? "",
          },
          sentAt: m?.sentAt ?? m?.timestamp ?? new Date().toISOString(),
        }))
    : [];
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messageText, setMessageText] = useState("");

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [safeMessages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text) return;
    if (typeof onSend === "function") {
      onSend(text);
    }
    setMessageText("");
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#fafbfc",
        borderRadius: 8,
        padding: 12,
        height: style.height || 250, // default to 250px if not provided
        border: "1px solid #eee",
        overflow: "hidden",
        ...style
      }}
    >
      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", marginBottom: 8 }}>
        {safeMessages.length === 0 && (
          <div style={{ color: "#aaa", textAlign: "center", marginTop: 60 }}>
            No messages yet.
          </div>
        )}
        {safeMessages.map((msg, idx) => {
          // Defensive: fallback for sender.id and msg.id
          const mine = msg.sender?.id === currentUserId;
          return (
            <div
              key={msg.id || idx}
              style={{
                display: "flex",
                flexDirection: mine ? "row-reverse" : "row",
                alignItems: "flex-end",
                marginBottom: 14,
                gap: 8,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: "#e0e0e0",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 18,
                  border: "2px solid #fff",
                  boxShadow: "0 1px 2px #0001",
                }}
                title={msg.sender?.name}
              >
                {msg.sender?.avatar ? (
                  <img
                    src={msg.sender.avatar}
                    alt={msg.sender.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span>{getInitials(msg.sender?.name || "")}</span>
                )}
              </div>
              {/* Message bubble and sender info */}
              <div style={{ maxWidth: "80%", textAlign: mine ? "right" : "left" }}>
                <div style={{ fontSize: 13, color: "#555", fontWeight: 500, marginBottom: 1 }}>
                  {msg.sender?.name ?? "User"}{" "}
                  <span style={{ color: "#999", fontSize: "11px", fontWeight: 400 }}>
                    ({msg.sender?.role?.toLowerCase() || "user"})
                  </span>
                </div>
                <div
                  style={{
                    background: mine ? "#1976d2" : "#f5f5f5",
                    color: mine ? "#fff" : "#222",
                    padding: "8px 14px",
                    borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    wordBreak: "break-word",
                    fontSize: 15,
                    boxShadow: "0 1px 2px #0001",
                  }}
                >
                  {msg.content}
                </div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {formatTimestamp(msg.sentAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {/* Input */}
      <form
        onSubmit={handleSend}
        style={{ display: "flex", gap: 8, alignItems: "center" }}
        autoComplete="off"
      >
        <input
          type="text"
          value={messageText}
          onChange={e => setMessageText(e.target.value)}
          style={{
            flex: 1,
            padding: 8,
            borderRadius: 4,
            border: "1px solid #ccc",
            fontSize: 15
          }}
          placeholder="Type a message..."
          disabled={!onSend}
        />
        <button
          type="submit"
          style={{
            padding: "8px 18px",
            borderRadius: 4,
            border: "none",
            background: "#1976d2",
            color: "#fff",
            fontWeight: 600,
            cursor: onSend ? "pointer" : "not-allowed"
          }}
          disabled={!onSend || !messageText.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}
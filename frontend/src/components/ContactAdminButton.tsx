import React, { useState } from "react";

// Simple modal styling (you can improve with CSS or a UI library)
const modalStyle: React.CSSProperties = {
  position: "fixed",
  left: 0,
  top: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modalContentStyle: React.CSSProperties = {
  background: "#fff",
  padding: 32,
  borderRadius: 10,
  minWidth: 320,
  maxWidth: "90vw",
  boxShadow: "0 2px 24px #0003",
  position: "relative",
};

export default function ContactAdminButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", tel: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Use API_URL for all backend requests
  const API_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "";

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch(`${API_URL}/api/contact-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setSent(true);
    } catch {
      setError("Failed to send message. Please try again.");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setSent(false);
    setError("");
    setForm({ name: "", tel: "", message: "" });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          background: "#1976D2",
          color: "#fff",
          border: "none",
          padding: "12px 22px",
          borderRadius: 28,
          fontWeight: 600,
          fontSize: 17,
          cursor: "pointer",
          zIndex: 10000,
          boxShadow: "0 2px 12px #0002"
        }}
      >
        Contact Administrator
      </button>
      {open && (
        <div style={modalStyle} onClick={handleClose}>
          <div
            style={modalContentStyle}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={handleClose}
              style={{
                position: "absolute",
                right: 12,
                top: 12,
                background: "transparent",
                border: "none",
                fontSize: 22,
                cursor: "pointer",
                color: "#888",
              }}
              aria-label="Close"
              title="Close"
              type="button"
            >
              ×
            </button>
            <h3 style={{ marginTop: 0, marginBottom: 20, color: "#1976D2" }}>
              Contact Administrator
            </h3>
            {sent ? (
              <p style={{ color: "#388e3c", textAlign: "center", fontWeight: 500 }}>
                Message sent to admin!
              </p>
            ) : (
              <form onSubmit={handleSubmit} style={{ minWidth: 260 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 2 }}>Name:</label>
                  <input
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    style={{
                      width: "100%",
                      padding: "7px",
                      borderRadius: 5,
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 2 }}>Tel:</label>
                  <input
                    name="tel"
                    value={form.tel}
                    onChange={handleChange}
                    required
                    style={{
                      width: "100%",
                      padding: "7px",
                      borderRadius: 5,
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", marginBottom: 2 }}>Message:</label>
                  <textarea
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    required
                    rows={3}
                    style={{
                      width: "100%",
                      padding: "7px",
                      borderRadius: 5,
                      border: "1px solid #ccc",
                    }}
                  />
                </div>
                <button
                  type="submit"
                  style={{
                    background: "#1976D2",
                    color: "#fff",
                    border: "none",
                    padding: "9px 24px",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 16,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  Send
                </button>
                {error && (
                  <p style={{ color: "#d32f2f", marginTop: 8, textAlign: "center" }}>
                    {error}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
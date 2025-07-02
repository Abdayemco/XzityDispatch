import React, { useState } from "react";

export default function BlockedAccount() {
  const [form, setForm] = useState({ name: "", tel: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/contact-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed to send message");
      setSent(true);
    } catch (err) {
      setError("Failed to send message. Please try again.");
    }
  };

  if (sent)
    return (
      <p style={{ color: "#388e3c", textAlign: "center", fontWeight: 500 }}>
        Message sent to admin!
      </p>
    );

  return (
    <div>
      <p style={{ color: "#d32f2f", margin: "18px 0 12px", textAlign: "center" }}>
        Account Disabled, Kindly contact Admin for further assistance
      </p>
      <form
        onSubmit={handleSubmit}
        style={{
          marginTop: 10,
          maxWidth: 320,
          marginLeft: "auto",
          marginRight: "auto",
          textAlign: "left",
        }}
      >
        <div style={{ marginBottom: 10 }}>
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
        <div style={{ marginBottom: 10 }}>
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
        <div style={{ marginBottom: 10 }}>
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
    </div>
  );
}
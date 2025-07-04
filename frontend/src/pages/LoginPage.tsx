import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

// --- Blocked Account Component ---
function BlockedAccount() {
  const [form, setForm] = useState({ name: "", tel: "", message: "" });
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/contact-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error("Failed to send message");
      setSent(true);
    } catch (err) {
      setError("Failed to send message. Please try again.");
    }
  };

  if (sent) return <p style={{ color: "#388e3c" }}>Message sent to admin!</p>;

  return (
    <div>
      <p style={{ color: "#d32f2f", margin: "18px 0 12px" }}>
        Account Disabled, Kindly contact Admin for further assistance
      </p>
      <form onSubmit={handleSubmit} style={{ marginTop: 10, textAlign: "left" }}>
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
              border: "1px solid #ccc"
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
              border: "1px solid #ccc"
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
              border: "1px solid #ccc"
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
            cursor: "pointer"
          }}
        >
          Send
        </button>
        {error && <p style={{ color: "#d32f2f", marginTop: 8 }}>{error}</p>}
      </form>
    </div>
  );
}

// --- Main Login Page ---
export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [blocked, setBlocked] = useState(false);
  const navigate = useNavigate();
  const phonePattern = /^\+?\d{10,15}$/;

  // --- Helper: Fully clear all user/ride state from storage and memory ---
  function clearSession() {
    // Remove all session-related localStorage keys
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("userId");
    localStorage.removeItem("driverId");
    localStorage.removeItem("vehicleType");
    localStorage.removeItem("rideStartedAt");
    localStorage.removeItem("rideAcceptedAt");
    localStorage.removeItem("currentDriverRideId");
    localStorage.removeItem("currentDriverJobStatus");
    localStorage.removeItem("currentRideId");
    localStorage.removeItem("currentRideStatus");
    localStorage.removeItem("pendingPhone");
    // (You can add/remove more keys as needed for your app)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!phonePattern.test(phone)) {
      setMessage("Please enter a valid phone number, with or without '+'.");
      return;
    }
    setLoading(true);
    setMessage("");
    setBlocked(false);

    // Always clear session before login to avoid cross-user issues
    clearSession();

    try {
      const deviceId = getDeviceId();
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, deviceId }),
      });
      const data = await res.json();
      console.log("[LOGIN RESPONSE]", data);

      // If login is successful and a token is received
      if (res.ok && data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", (data.role || "").toLowerCase());
        if (data.user && typeof data.user.id === "number") {
          localStorage.setItem("userId", String(data.user.id));
        }
        if (data.role && data.role.toLowerCase() === "driver" && data.user) {
          localStorage.setItem("driverId", String(data.user.id));
          if (data.user.vehicleType) {
            localStorage.setItem("vehicleType", data.user.vehicleType.toLowerCase());
          }
        }
        setMessage("Login successful! Redirecting...");
        setTimeout(() => {
          if (data.role && data.role.toLowerCase() === "customer") {
            navigate("/customer");
          } else if (data.role && data.role.toLowerCase() === "driver") {
            navigate("/driver");
          } else if (data.role && data.role.toLowerCase() === "admin") {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }, 600);
        setLoading(false);
        return;
      }

      // If verification is required (untrusted device or unverified phone)
      if (
        data.action === "verification_required" ||
        data.error === "Verification code required" ||
        (res.status === 202 && data.action === "verification_required")
      ) {
        // Save info for verification page
        localStorage.setItem("pendingPhone", phone);
        setMessage("Verification required. Redirecting...");
        setTimeout(() => {
          navigate("/verify", {
            state: {
              phone,
              deviceId,
              role: data.role,
              message: data.message,
            }
          });
        }, 600);
        setLoading(false);
        return;
      }

      // Check for blocked status by admin
      if (
        data.error &&
        data.error.toLowerCase().includes("account disabled, kindly contact admin")
      ) {
        setBlocked(true);
        setMessage(""); // Hide normal error
        setLoading(false);
        return;
      }

      // Any other error
      setMessage(data.error || "Login failed.");
    } catch (err) {
      setMessage("Could not connect to server.");
    }
    setLoading(false);
  }

  return (
    <div style={{
      maxWidth: 400,
      margin: "80px auto",
      boxShadow: "0 2px 24px #0002",
      padding: 32,
      borderRadius: 16,
      background: "#fff",
      textAlign: "center"
    }}>
      <img src={logo} alt="Logo" style={{ width: 90, marginBottom: 16 }} />
      <h2 style={{ marginBottom: 28, color: "#1976D2", fontWeight: 700, letterSpacing: 1 }}>Login</h2>
      {blocked ? (
        <BlockedAccount />
      ) : (
        <>
          <form onSubmit={handleLogin} autoComplete="off">
            <input
              type="text"
              placeholder="Phone number"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 18,
                padding: "12px 10px",
                fontSize: 17,
                border: "1px solid #ccc",
                borderRadius: 8,
                outline: "none",
                fontFamily: "inherit"
              }}
              autoFocus
            />
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                background: "#1976D2",
                color: "#fff",
                border: "none",
                padding: "12px 0",
                borderRadius: 8,
                fontSize: 18,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s"
              }}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
          {message && (
            <div style={{
              color: message.toLowerCase().includes("success") ? "#388e3c" : "#d32f2f",
              marginTop: 16,
              fontWeight: 500
            }}>
              {message}
            </div>
          )}
          <div style={{ marginTop: 18 }}>
            <a href="/register" style={{ color: "#1976D2", textDecoration: "none" }}>Don't have an account? Register</a>
          </div>
        </>
      )}
    </div>
  );
}
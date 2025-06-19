import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png"; // <-- Update this path if needed

function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("deviceId", id);
  }
  return id;
}

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const phonePattern = /^\+?\d{10,15}$/;

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!phonePattern.test(phone)) {
      setMessage("Please enter a valid phone number, with or without '+'.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const deviceId = getDeviceId();
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, deviceId }),
      });
      const data = await res.json();
      console.log("[LOGIN RESPONSE]", data);

      if (res.ok) {
        if (data.token) {
          localStorage.setItem("token", data.token);
        } else {
          setMessage("Login failed: No token received from server.");
          setLoading(false);
          return;
        }
        localStorage.setItem("role", (data.role || "").toLowerCase());
        // Always store userId as a stringified integer if backend provides it
        if (data.user && typeof data.user.id === "number") {
          localStorage.setItem("userId", String(data.user.id));
        }
        // If driver, also store driverId and vehicleType for future use
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
        return;
      } else if (data.action === "verification_required" || data.error === "Verification code required") {
        // Save info for verification page
        localStorage.setItem("pendingPhone", phone);
        setMessage("Verification required. Redirecting...");
        setTimeout(() => {
          navigate("/verify", { state: { phone } });
        }, 600);
        return;
      } else {
        setMessage(data.error || "Login failed.");
      }
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
    </div>
  );
}
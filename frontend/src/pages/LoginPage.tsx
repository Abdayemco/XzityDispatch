import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";

// Helper to get or generate a deviceId
function getDeviceId() {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  // Accepts + at start and 10-15 digits after
  const phonePattern = /^\+?[0-9]{10,15}$/;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phonePattern.test(phone)) {
      setMessage("Please enter a valid phone number, with or without '+'.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const deviceId = getDeviceId();
      const endpoint = showCode
        ? "http://localhost:5000/api/auth/verify"
        : "http://localhost:5000/api/auth/login";
      const body = showCode
        ? { phone, code, deviceId }
        : { phone, deviceId };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", (data.role || "").toLowerCase());
        // Always store userId as a stringified integer if backend provides it
        if (data.user && typeof data.user.id === "number") {
          localStorage.setItem("userId", String(data.user.id));
        }
        // If driver, also store driverId and vehicleType for future use
        if (data.role && data.role.toLowerCase() === "driver" && data.user) {
          localStorage.setItem("driverId", String(data.user.id));
          if (data.user.vehicleType) {
            localStorage.setItem(
              "vehicleType",
              data.user.vehicleType.toLowerCase()
            );
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
      } else if (
        data.action === "verification_required" ||
        data.error === "Verification code required"
      ) {
        setShowCode(true);
        setMessage(
          "Please enter the verification code you received from the admin."
        );
      } else if (data.error && data.error.toLowerCase().includes("not found")) {
        setMessage("Phone number not registered. Please register below.");
      } else {
        setMessage(data.error || "Login failed.");
      }
    } catch (err) {
      setMessage("Could not connect to server.");
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        maxWidth: 340,
        margin: "40px auto",
        padding: "2em",
        borderRadius: 8,
        background: "#fff",
        boxShadow: "0 2px 16px #0001",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <img src={logo} alt="XZity Dispatch" style={{ height: 70 }} />
      </div>
      <h2 style={{ textAlign: "center" }}>Login</h2>
      <form onSubmit={handleSubmit} autoComplete="off">
        <label>
          Phone Number:
          <input
            autoFocus
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            minLength={10}
            maxLength={16}
            placeholder="e.g. +12345678901"
            style={{ width: "100%", margin: "8px 0", padding: "0.5em" }}
            pattern="^\+?[0-9]{10,15}$"
            inputMode="tel"
          />
        </label>
        {showCode && (
          <label>
            Verification Code:
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              placeholder="Enter verification code"
              style={{ width: "100%", margin: "8px 0", padding: "0.5em" }}
              maxLength={8}
            />
          </label>
        )}
        <button
          type="submit"
          disabled={loading || !phone || (showCode && !code)}
          style={{
            width: "100%",
            padding: "0.7em 0",
            background: "#1976D2",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            marginTop: 12,
            fontSize: 16,
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <Link to="/register">Don't have an account? Register</Link>
        </div>
        {message && (
          <div
            style={{
              marginTop: 14,
              color: message.includes("success") ? "#388e3c" : "#d32f2f",
              textAlign: "center",
            }}
          >
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code: showCode ? code : undefined }),
      });
      const data = await res.json();
      console.log("Login response:", data, "role:", data.role);
      if (res.ok) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("role", data.role);
        if (data.user && data.user.id) {
          localStorage.setItem("userId", data.user.id); // Always set for all roles
        }
        // Store driverId and vehicleType for drivers
        if (data.role === "DRIVER" && data.user) {
          localStorage.setItem("driverId", data.user.id);
          if (data.user.vehicleType) {
            localStorage.setItem("vehicleType", data.user.vehicleType.toLowerCase());
          }
        }

        setMessage("Login successful! Redirecting...");
        setTimeout(() => {
          if (data.role === "CUSTOMER") {
            navigate("/customer");
          } else if (data.role === "DRIVER") {
            navigate("/driver");
          } else if (data.role === "ADMIN") {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }, 600);
        return;
      } else if (data.error === "Verification code required") {
        setShowCode(true);
        setMessage("Please enter the verification code you received from the admin.");
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
      maxWidth: 340,
      margin: "40px auto",
      padding: "2em",
      borderRadius: 8,
      background: "#fff",
      boxShadow: "0 2px 16px #0001"
    }}>
      <h2 style={{ textAlign: "center" }}>Login</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Phone Number:
          <input
            type="text"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            style={{ width: "100%", margin: "8px 0", padding: "0.5em" }}
          />
        </label>
        {showCode && (
          <label>
            Verification Code:
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              required
              style={{ width: "100%", margin: "8px 0", padding: "0.5em" }}
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
            fontSize: 16
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <div style={{ marginTop: 12, textAlign: "center" }}>
          <Link to="/register">Don't have an account? Register</Link>
        </div>
        {message && (
          <div style={{ marginTop: 14, color: message.includes("success") ? "#388e3c" : "#d32f2f", textAlign: "center" }}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
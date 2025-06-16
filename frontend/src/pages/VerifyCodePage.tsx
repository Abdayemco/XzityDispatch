import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";

// Helper to get or generate a deviceId (same as in LoginPage)
function getDeviceId() {
  let deviceId = localStorage.getItem("deviceId");
  if (!deviceId) {
    deviceId = "dev-" + Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem("deviceId", deviceId);
  }
  return deviceId;
}

export default function VerifyCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  // Retrieve phone and role from location state or localStorage
  const phone = location.state?.phone || localStorage.getItem("pendingPhone");
  let role = location.state?.role || localStorage.getItem("pendingRole");

  useEffect(() => {
    if (!phone || !role) {
      navigate("/register");
    }
    // eslint-disable-next-line
  }, [phone, role, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const deviceId = getDeviceId();
      const res = await fetch("http://localhost:5000/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, deviceId }),
      });
      const data = await res.json();
      if (res.ok) {
        // Use backend role if present, fallback to frontend role
        if (data.role) {
          role = data.role;
        }
        localStorage.setItem("token", data.token);

        // Save userId and driverId as integer-string if backend provides it
        if (data.user && typeof data.user.id === "number") {
          localStorage.setItem("userId", String(data.user.id));
        }
        if (
          role &&
          role.toUpperCase() === "DRIVER" &&
          data.user &&
          typeof data.user.id === "number"
        ) {
          localStorage.setItem("driverId", String(data.user.id));
          if (data.user.vehicleType) {
            localStorage.setItem(
              "vehicleType",
              data.user.vehicleType.toLowerCase()
            );
          }
        }
        localStorage.setItem("role", (role || "").toLowerCase());

        setMessage("Verification successful! Redirecting...");
        // Normalize role for redirect
        const roleNorm = (role || "").toUpperCase();
        if (roleNorm === "CUSTOMER") {
          setRedirectTo("/customer");
        } else if (roleNorm === "DRIVER") {
          setRedirectTo("/driver");
        } else if (roleNorm === "ADMIN") {
          setRedirectTo("/admin");
        } else {
          setRedirectTo("/");
        }
      } else {
        setMessage(data.error || "Verification failed.");
      }
    } catch (err) {
      setMessage("Could not connect to server.");
    }
    setLoading(false);
  }

  useEffect(() => {
    if (redirectTo) {
      const timer = setTimeout(() => navigate(redirectTo), 800);
      return () => clearTimeout(timer);
    }
  }, [redirectTo, navigate]);

  // Don't render form if phone/role missing (redirecting)
  if (!phone || !role) return null;

  return (
    <div style={{
      maxWidth: 340, margin: "40px auto", padding: "2em",
      borderRadius: 8, background: "#fff", boxShadow: "0 2px 16px #0001"
    }}>
      <h2>Enter Verification Code</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value)}
          required
          placeholder="Verification code"
          style={{ width: "100%", margin: "8px 0", padding: "0.5em" }}
        />
        <button
          type="submit"
          disabled={loading || !code}
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
          {loading ? "Verifying..." : "Verify"}
        </button>
        {message && (
          <div style={{ marginTop: 14, color: message.includes("success") ? "#388e3c" : "#d32f2f", textAlign: "center" }}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
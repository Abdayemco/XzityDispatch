import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "CUSTOMER",
    vehicleType: "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const submitData = { ...form };
      if (form.role !== "DRIVER") {
        delete submitData.vehicleType;
      } else {
        submitData.vehicleType = form.vehicleType.toUpperCase();
      }
      const res = await fetch("http://localhost:5000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      const data = await res.json();
      if (res.ok) {
        // Store phone and role for verification step
        localStorage.setItem("pendingPhone", form.phone);
        localStorage.setItem("pendingRole", form.role);

        // Store user ID as stringified integer for ALL users if backend returns it
        if (data?.user && typeof data.user.id === "number") {
          localStorage.setItem("userId", String(data.user.id));
        }

        // If registering as a driver, also store driverId and vehicleType
        if (form.role === "DRIVER" && data?.user) {
          localStorage.setItem("driverId", String(data.user.id));
          localStorage.setItem("vehicleType", form.vehicleType.toLowerCase());
        }

        setMessage("Registration successful! Redirecting to verification...");
        setTimeout(() => {
          navigate("/verify", { state: { phone: form.phone, role: form.role } });
        }, 800);
      } else {
        setMessage(data.error || "Registration failed.");
      }
    } catch (err) {
      setMessage("Could not connect to server.");
    }
    setLoading(false);
  }

  const registerDisabled =
    loading ||
    (form.role === "DRIVER" && !form.vehicleType);

  return (
    <div style={{ maxWidth: 340, margin: "60px auto", background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 8px #0001" }}>
      <h2 style={{ textAlign: "center" }}>Register</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <input name="name" type="text" className="form-control" style={{ width: "100%", marginBottom: 12 }} value={form.name} onChange={handleChange} required />
        </div>
        <div>
          <label>Phone</label>
          <input name="phone" type="tel" className="form-control" style={{ width: "100%", marginBottom: 12 }} value={form.phone} onChange={handleChange} required />
        </div>
        <div>
          <label>
            Email {form.role === "ADMIN" && <span style={{ color: "#d32f2f" }}>*</span>}
          </label>
          <input
            name="email"
            type="email"
            className="form-control"
            style={{ width: "100%", marginBottom: 12 }}
            value={form.email}
            onChange={handleChange}
            required={form.role === "ADMIN"}
            placeholder={form.role === "ADMIN" ? "Required for admin" : "Optional for customer/driver"}
          />
        </div>
        <div>
          <label>Password</label>
          <input name="password" type="password" className="form-control" style={{ width: "100%", marginBottom: 12 }} value={form.password} onChange={handleChange} required />
        </div>
        <div>
          <label>Role</label>
          <select name="role" className="form-control" style={{ width: "100%", marginBottom: 12 }} value={form.role} onChange={handleChange}>
            <option value="CUSTOMER">Customer</option>
            <option value="DRIVER">Driver</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        {form.role === "DRIVER" && (
          <div>
            <label>Vehicle Type</label>
            <select
              name="vehicleType"
              className="form-control"
              style={{ width: "100%", marginBottom: 12 }}
              value={form.vehicleType}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select vehicle type
              </option>
              <option value="car">Car</option>
              <option value="bike">Bike</option>
              <option value="toktok">Three-wheel Bike (Toktok)</option>
              <option value="truck">Truck</option>
            </select>
          </div>
        )}
        <button type="submit" disabled={registerDisabled} style={{ width: "100%", background: "#1976D2", color: "#fff", border: "none", padding: "0.8em", borderRadius: 6 }}>
          {loading ? "Registering..." : "Register"}
        </button>
      </form>
      {message && (
        <div style={{ color: message.includes("success") ? "#388e3c" : "#d32f2f", marginTop: 12, textAlign: "center" }}>{message}</div>
      )}
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <Link to="/login">Already have an account? Login</Link>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import TermsModal from "../components/TermsModal"; // adjust path as needed

const vehicleOptions = [
  { value: "", label: "Select vehicle type" },
  { value: "car", label: "Car" },
  { value: "delivery", label: "Delivery" },
  { value: "tuktuk", label: "Tuktuk (Three-wheel Bike)" },
  { value: "truck", label: "Truck" },
  { value: "water_truck", label: "Water Truck" },
  { value: "tow_truck", label: "Tow Truck" },
  { value: "wheelchair", label: "Wheelchair / Special Needs" },
];

// Utility: guess country from browser or IP
async function getDefaultCountry() {
  // Try IP-based detection for more accuracy
  try {
    const res = await fetch("https://ipapi.co/json/");
    const data = await res.json();
    if (data && data.country_code) return data.country_code.toLowerCase();
  } catch {}
  const lang = navigator.language || "";
  return lang.slice(-2).toLowerCase();
}

export default function RegisterPage() {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    password: "",
    role: "CUSTOMER",
    vehicleType: "",
    avatar: "",
    agreed: false,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showPolicy, setShowPolicy] = useState(false);
  const [phoneValid, setPhoneValid] = useState(false);
  const [rawPhone, setRawPhone] = useState("");
  const [defaultCountry, setDefaultCountry] = useState(undefined);

  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    getDefaultCountry().then(code => {
      if (mounted) setDefaultCountry(code || "us");
    });
    return () => { mounted = false; };
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
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
      if (!form.avatar?.trim()) {
        delete submitData.avatar;
      }
      submitData.phone = form.phone;
      delete submitData.agreed;

      // Use environment variable for API URL
      const API_URL = import.meta.env.VITE_API_URL;
      const res = await fetch(`${API_URL}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem("pendingPhone", form.phone);
        localStorage.setItem("pendingRole", form.role);
        if (data?.user && typeof data.user.id === "number") {
          localStorage.setItem("userId", String(data.user.id));
        }
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
    !form.name ||
    !form.password ||
    !form.phone ||
    !phoneValid ||
    !form.agreed ||
    (form.role === "DRIVER" && !form.vehicleType);

  return (
    <div style={{ maxWidth: 340, margin: "60px auto", background: "#fff", padding: 24, borderRadius: 8, boxShadow: "0 2px 8px #0001" }}>
      <img
        src="/logo.png"
        alt="Xzity Logo"
        style={{
          display: "block",
          margin: "0 auto 27px auto",
          height: 84,
          objectFit: "contain",
        }}
      />
      <h2 style={{ textAlign: "center" }}>Register</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>Name</label>
          <input name="name" type="text" className="form-control" style={{ width: "100%", marginBottom: 12 }} value={form.name} onChange={handleChange} required />
        </div>
        <div>
          <label>Phone</label>
          <PhoneInput
            country={defaultCountry}
            value={rawPhone}
            onChange={(value, data, event, formattedValue) => {
              setRawPhone(value);
              setForm(f => ({ ...f, phone: "+" + value }));
              setPhoneValid(value.length > 6 && value.length < 20 && !!data?.countryCode);
            }}
            enableSearch={true}
            enableAreaCodes={true}
            inputProps={{
              name: "phone",
              required: true,
              className: "form-control",
              style: { width: "100%", marginBottom: 12 },
            }}
          />
          {!phoneValid && !!rawPhone && (
            <div style={{ color: "#d32f2f", fontSize: 13, marginTop: -8, marginBottom: 8 }}>
              Please enter a valid phone number for your country.
            </div>
          )}
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
              {vehicleOptions.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.value === ""}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label>
            Avatar URL <span style={{ color: "#888", fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            name="avatar"
            type="url"
            className="form-control"
            style={{ width: "100%", marginBottom: 12 }}
            value={form.avatar}
            onChange={handleChange}
            placeholder="https://example.com/avatar.jpg"
          />
        </div>
        <div style={{ margin: "10px 0 14px 0", display: "flex", alignItems: "center" }}>
          <input
            type="checkbox"
            id="agreement"
            name="agreed"
            checked={form.agreed}
            onChange={e => setForm(f => ({ ...f, agreed: e.target.checked }))}
            required
            style={{ marginRight: 8 }}
          />
          <label htmlFor="agreement" style={{ fontSize: 14 }}>
            I agree to the{" "}
            <button type="button" style={{ background: "none", border: "none", color: "#1976D2", textDecoration: "underline", cursor: "pointer", padding: 0 }} onClick={() => setShowPolicy(true)}>
              terms and privacy policy
            </button>
          </label>
        </div>
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
      {showPolicy && <TermsModal onClose={() => setShowPolicy(false)} />}
    </div>
  );
}
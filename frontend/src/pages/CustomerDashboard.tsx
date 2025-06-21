import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerCustomer from "../assets/marker-customer.png";
import carIcon from "../assets/marker-car.png";
import bikeIcon from "../assets/marker-bike.png";
import tuktukIcon from "../assets/marker-toktok.png";
import truckIcon from "../assets/marker-truck.png";

// Utility: Get icon URL for a given vehicleType (enum values)
function getVehicleIcon(vehicleType: string) {
  switch (vehicleType) {
    case "CAR": return carIcon;
    case "BIKE": return bikeIcon;
    case "TUKTUK": return tuktukIcon;
    case "TRUCK": return truckIcon;
    default: return carIcon;
  }
}

// Create a Leaflet icon
function createLeafletIcon(url: string, w = 32, h = 41) {
  return L.icon({
    iconUrl: url,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 10],
    shadowUrl: undefined,
  });
}

// Dropdown options now match Prisma enum exactly
const vehicleOptions = [
  { value: "", label: "Select type", icon: "" },
  { value: "CAR", label: "Car", icon: carIcon },
  { value: "BIKE", label: "Bike", icon: bikeIcon },
  { value: "TUKTUK", label: "Tuktuk", icon: tuktukIcon },
  { value: "TRUCK", label: "Truck", icon: truckIcon }
];

// This function now parses userId as integer, or returns null if invalid
function getCustomerIdFromStorage(): number | null {
  const raw = localStorage.getItem("userId");
  if (!raw) return null;
  const parsed = Number(raw);
  return !isNaN(parsed) && Number.isInteger(parsed) ? parsed : null;
}

// Accept lowercase and mapped ride status from backend
type RideStatus = "pending" | "accepted" | "in_progress" | "done" | "cancelled" | null;

// --- New: simple rating component ---
function RateDriver({ rideId, onRated }: { rideId: number, onRated: () => void }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`/api/rides/${rideId}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, feedback }),
    });
    setSubmitting(false);
    onRated(); // Immediately reset the dashboard after rating
  }

  return (
    <form onSubmit={handleSubmit} style={{ textAlign: "center", marginTop: 30 }}>
      <h3>Rate your driver</h3>
      <div style={{ marginBottom: 10 }}>
        {[1,2,3,4,5].map(star => (
          <button
            type="button"
            key={star}
            onClick={() => setRating(star)}
            style={{
              color: rating >= star ? "#FFD700" : "#CCC",
              fontSize: 28,
              border: "none",
              background: "none",
              cursor: "pointer"
            }}
            aria-label={`${star} star`}
          >★</button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        placeholder="Optional feedback"
        rows={3}
        style={{ display: "block", margin: "12px auto", width: "70%" }}
      />
      <button type="submit" disabled={submitting} style={{ padding: "0.5em 2em", marginTop: 8 }}>
        {submitting ? "Submitting..." : "Submit & Request New Ride"}
      </button>
    </form>
  );
}

export default function CustomerDashboard() {
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupSet, setPickupSet] = useState(false);
  const [rideId, setRideId] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>(null);
  const [driverInfo, setDriverInfo] = useState<{ name?: string; vehicleType?: string } | null>(null);
  const [showDoneActions, setShowDoneActions] = useState(false);

  // Get user's current location and set as pickup location by default
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        setUserLocation(loc);
        setPickupLocation(loc);
      },
      () => {
        // fallback (Nairobi)
        const loc = { lng: 36.8219, lat: -1.2921 };
        setUserLocation(loc);
        setPickupLocation(loc);
      }
    );
  }, []);

  // Poll backend to check ride status and driver assignment
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pickupSet && rideId && rideStatus !== "done" && rideStatus !== "cancelled") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/rides/${rideId}/status`);
          const data = await res.json();
          if (data.status) setRideStatus(data.status);

          // Optionally, fetch driver info if accepted or in progress
          if ((data.status === "accepted" || data.status === "in_progress") && data.driver) {
            setDriverInfo({
              name: data.driver.name || "",
              vehicleType: data.driver.vehicleType || ""
            });
          }
        } catch (err) {
          // Optionally handle polling error
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pickupSet, rideId, rideStatus]);

  async function handleConfirmPickup() {
    setWaiting(true);
    setError(null);
    if (!pickupLocation || !vehicleType) {
      setError("Pickup location and vehicle type required.");
      setWaiting(false);
      return;
    }
    const token = localStorage.getItem("token");
    const customerId = getCustomerIdFromStorage();
    if (!token || customerId === null) {
      setError("Not logged in.");
      setWaiting(false);
      return;
    }

    try {
      const res = await fetch("/api/rides/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId, // This is now always a number
          originLat: pickupLocation.lat,
          originLng: pickupLocation.lng,
          destLat: pickupLocation.lat, // For demo, use pickup as dest; update for real dest!
          destLng: pickupLocation.lng,
          vehicleType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create ride.");
        setWaiting(false);
        return;
      }
      setPickupSet(true);
      setRideId(data.rideId || data.id); // Store the ride ID for polling (either rideId or id)
      setRideStatus("pending");
      setWaiting(false);
    } catch (err: any) {
      setError("Network or server error.");
      setWaiting(false);
    }
  }

  async function handleCancelRide() {
    if (!rideId) return;
    setWaiting(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/rides/${rideId}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to cancel ride.");
        setWaiting(false);
        return;
      }
      setRideStatus("cancelled");
      setWaiting(false);
    } catch (err) {
      setError("Network or server error.");
      setWaiting(false);
    }
  }

  async function handleMarkAsDone() {
    if (!rideId) return;
    setWaiting(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/rides/${rideId}/done`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {})
        }
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to mark ride as done.");
        setWaiting(false);
        return;
      }
      setRideStatus("done");
      setShowDoneActions(true);
      setWaiting(false);
    } catch (err) {
      setError("Network or server error.");
      setWaiting(false);
    }
  }

  // Reset all relevant state for new ride
  function handleReset() {
    setRideStatus(null);
    setPickupSet(false);
    setPickupLocation(userLocation);
    setVehicleType("");
    setRideId(null);
    setDriverInfo(null);
    setShowDoneActions(false);
  }

  // UI for various ride states
  if (
    (rideStatus === "pending" && pickupSet && rideId) ||
    (rideStatus === "accepted" || rideStatus === "in_progress")
  ) {
    // Show both buttons on "Waiting for a driver to accept your ride..." and during ride
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div>
          {rideStatus === "pending" && (
            <span style={{ fontWeight: "bold", fontSize: 22 }}>Waiting for a driver to accept your ride...</span>
          )}
          {rideStatus === "accepted" && (
            <span style={{ fontWeight: "bold", fontSize: 22 }}>Driver is on the way!</span>
          )}
          {rideStatus === "in_progress" && (
            <span style={{ fontWeight: "bold", fontSize: 22 }}>Enjoy your ride!</span>
          )}
        </div>
        {driverInfo && (rideStatus === "accepted" || rideStatus === "in_progress") && (
          <div style={{ margin: "12px 0" }}>
            <span>
              <b>Driver:</b> {driverInfo.name || "Assigned"}
              <br />
              <b>Vehicle:</b> {driverInfo.vehicleType || "Unknown"}
            </span>
          </div>
        )}
        <div style={{ marginTop: 18 }}>
          <button
            disabled={waiting}
            style={{
              background: "#f44336",
              color: "#fff",
              border: "none",
              padding: "0.7em 1.4em",
              borderRadius: 6,
              fontSize: 16,
              margin: "0 10px",
              opacity: waiting ? 0.5 : 1
            }}
            onClick={handleCancelRide}
          >
            Cancel Ride
          </button>
          {(rideStatus === "accepted" || rideStatus === "in_progress") && (
            <button
              disabled={waiting}
              style={{
                background: "#388e3c",
                color: "#fff",
                border: "none",
                padding: "0.7em 1.4em",
                borderRadius: 6,
                fontSize: 16,
                margin: "0 10px",
                opacity: waiting ? 0.7 : 1
              }}
              onClick={handleMarkAsDone}
            >
              Mark as Done
            </button>
          )}
        </div>
        {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  if (rideStatus === "done" && showDoneActions && rideId) {
    // After mark as done: show both RateDriver and Request Another Ride
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontWeight: "bold", fontSize: 20, color: "#388e3c" }}>
          Ride is complete. Thank you!
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginTop: 18 }}>
          <RateDriver
            rideId={rideId}
            onRated={handleReset}
          />
          <button
            style={{ background: "#1976D2", color: "#fff", border: "none", padding: "0.7em 1.4em", borderRadius: 6, fontSize: 16 }}
            onClick={handleReset}
          >
            Request Another Ride
          </button>
        </div>
      </div>
    );
  }

  if (rideStatus === "cancelled") {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontWeight: "bold", fontSize: 20, color: "#f44336" }}>
          Ride was cancelled.
        </div>
        <button
          style={{ marginTop: 24, background: "#1976D2", color: "#fff", border: "none", padding: "0.7em 1.4em", borderRadius: 6, fontSize: 16 }}
          onClick={handleReset}
        >
          Request New Ride
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f8f9fa",
      }}
    >
      <h2 style={{ textAlign: "center", margin: "0 0 14px 0" }}>Request a Ride</h2>
      <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {error && (
          <div style={{ color: "red", marginBottom: 8 }}>{error}</div>
        )}
        {!pickupSet && (
          <div style={{ marginBottom: 2 }}>
            <label htmlFor="vehicleType" style={{ fontWeight: "bold", marginRight: 8 }}>
              Choose your transportation type:
            </label>
            <select
              id="vehicleType"
              value={vehicleType}
              onChange={e => setVehicleType(e.target.value)}
              style={{ fontSize: 16, padding: "0.3em 1em", borderRadius: 6, marginRight: 8 }}
              required
            >
              {vehicleOptions.map(opt => (
                <option key={opt.value} value={opt.value} disabled={opt.value === ""}>
                  {opt.label}
                </option>
              ))}
            </select>
            {vehicleOptions.map(opt =>
              opt.value === vehicleType && opt.value !== "" ? (
                <img
                  key={opt.value}
                  src={opt.icon}
                  alt={opt.label}
                  style={{ width: 32, height: 32, verticalAlign: "middle" }}
                />
              ) : null
            )}
          </div>
        )}
        {!pickupSet && (
          <button
            onClick={handleConfirmPickup}
            disabled={!pickupLocation || !vehicleType || waiting}
            style={{
              background: "#1976D2",
              color: "#fff",
              border: "none",
              padding: "0.7em 1.4em",
              borderRadius: 6,
              fontSize: 16,
              width: "100%",
              marginBottom: 0,
              opacity: !pickupLocation || !vehicleType || waiting ? 0.7 : 1
            }}
          >
            {waiting ? "Requesting..." : "Confirm Pickup Location"}
          </button>
        )}
      </div>
      <div style={{ background: "#e0e0e0", borderRadius: 8, width: "90%", maxWidth: 700, margin: "0 auto", marginTop: 4, height: "48vh" }}>
        {userLocation && pickupLocation && (
          <MapContainer
            center={[userLocation.lat, userLocation.lng]}
            zoom={13}
            style={{ width: "100%", height: "100%", borderRadius: 10 }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* User's current & pickup location marker */}
            <Marker
              position={[pickupLocation.lat, pickupLocation.lng]}
              icon={createLeafletIcon(markerCustomer, 32, 41)}
            >
              <Popup>Your pickup location</Popup>
            </Marker>
          </MapContainer>
        )}
      </div>
    </div>
  );
}
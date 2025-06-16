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

export default function CustomerDashboard() {
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupSet, setPickupSet] = useState(false);
  const [jobAccepted, setJobAccepted] = useState(false);
  const [vehicleType, setVehicleType] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // Simulate driver accepting after ride creation (for demo)
  useEffect(() => {
    if (pickupSet && !jobAccepted) {
      const timeout = setTimeout(() => {
        setJobAccepted(true);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [pickupSet, jobAccepted]);

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
      setWaiting(false);
    } catch (err: any) {
      setError("Network or server error.");
      setWaiting(false);
    }
  }

  if (jobAccepted) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        Ride in progress...
        <br />
        <button
          style={{ marginTop: 16 }}
          onClick={() => {
            setJobAccepted(false);
            setPickupSet(false);
            setPickupLocation(userLocation);
            setVehicleType("");
          }}
        >
          Mark as Done (Reset)
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
        {pickupSet && !jobAccepted && (
          <div style={{ marginTop: 8, color: "#333" }}>Waiting for a driver to accept your ride...</div>
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
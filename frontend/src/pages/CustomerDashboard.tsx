import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerCustomer from "../assets/marker-customer.png";
import carIcon from "../assets/marker-car.png";
import deliveryIcon from "../assets/marker-delivery.png";
import tuktukIcon from "../assets/marker-toktok.png";
import limoIcon from "../assets/marker-limo.png";
import wheelchairIcon from "../assets/marker-wheelchair.png";
import truckIcon from "../assets/marker-truck.png";
import waterTruckIcon from "../assets/marker-watertruck.png";
import towTruckIcon from "../assets/marker-towtruck.png";
import fireIcon from "../assets/emergency-fire.png";
import policeIcon from "../assets/emergency-police.png";
import hospitalIcon from "../assets/emergency-hospital.png";
import RestChatWindow from "../components/RestChatWindow";

// ICONS
function createLeafletIcon(url: string, w = 32, h = 41) {
  return L.icon({
    iconUrl: url,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 10],
    shadowUrl: undefined,
  });
}
function createEmergencyIcon(url: string) {
  return L.icon({
    iconUrl: url,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    shadowUrl: undefined,
  });
}

const vehicleOptions = [
  { value: "", label: "Select type", icon: "" },
  { value: "CAR", label: "Car", icon: carIcon },
  { value: "DELIVERY", label: "Delivery", icon: deliveryIcon },
  { value: "TUKTUK", label: "Tuktuk", icon: tuktukIcon },
  { value: "LIMO", label: "Limo", icon: limoIcon },
  { value: "WHEELCHAIR", label: "Wheelchair", icon: wheelchairIcon },
  { value: "TRUCK", label: "Truck", icon: truckIcon },
  { value: "WATER_TRUCK", label: "Water Truck", icon: waterTruckIcon },
  { value: "TOW_TRUCK", label: "Tow Truck", icon: towTruckIcon }
];

function getCustomerIdFromStorage(): number | null {
  const raw = localStorage.getItem("userId");
  if (!raw) return null;
  const parsed = Number(raw);
  return !isNaN(parsed) && Number.isInteger(parsed) ? parsed : null;
}

// TYPES
type RideStatus = "pending" | "accepted" | "in_progress" | "done" | "cancelled" | "scheduled" | "no_show" | null;
type EmergencyLocation = {
  type: "fire" | "police" | "hospital";
  name: string;
  lat: number;
  lng: number;
  phone?: string;
  icon: string;
};
type OverpassElement = {
  id: number;
  lat: number;
  lon: number;
  tags: {
    name?: string;
    phone?: string;
    amenity?: string;
    emergency?: string;
  };
};
type DriverInfo = { name?: string; vehicleType?: string; };

type ScheduledRide = {
  id: number;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  vehicleType: string;
  destinationName?: string;
  note?: string;
  scheduledAt: string;
  status: RideStatus;
};

type ActiveRide = {
  id: number;
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  vehicleType: string;
  status: RideStatus;
  driver?: DriverInfo | null;
  scheduledAt?: string;
  note?: string;
  destinationName?: string;
};

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

// RATING COMPONENT
function RateDriver({ rideId, onRated }: { rideId: number, onRated: () => void }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, feedback }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit rating");
        setSubmitting(false);
        return;
      }
      onRated();
    } catch {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  };
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
      {error && <div style={{ color: "#d32f2f", marginTop: 8 }}>{error}</div>}
    </form>
  );
}

export default function CustomerDashboard() {
  // --- State
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [destination, setDestination] = useState<{ lng: number; lat: number } | null>(null);
  const [destinationName, setDestinationName] = useState<string>("");
  const [pickupSet, setPickupSet] = useState(false);
  const [rideId, setRideId] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [emergencyLocations, setEmergencyLocations] = useState<EmergencyLocation[]>([]);
  const [chatOpen, setChatOpen] = useState(false);

  // Scheduled rides and active rides
  const [scheduledRide, setScheduledRide] = useState<ScheduledRide | null>(null);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);

  // To detect ride status transition for chat opening
  const [prevRideStatus, setPrevRideStatus] = useState<RideStatus>(null);

  // For rating UI
  const [showRating, setShowRating] = useState(false);
  const [lastFinishedRideId, setLastFinishedRideId] = useState<number | null>(null);

  // --- Reset functions
  function resetRegularRide() {
    setRideId(null);
    setRideStatus(null);
    setDriverInfo(null);
    setChatOpen(false);
    setActiveRide(null);
    setWaiting(false);
  }
  function resetAll() {
    resetRegularRide();
    setPickupSet(false);
    setVehicleType("");
    if (userLocation) setPickupLocation(userLocation);
    setDestination(null);
    setDestinationName("");
    setError(null);
  }

  // --- Listen for login/logout and update token in all tabs
  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // --- Restore active ride from backend on mount or after login
  useEffect(() => {
    async function restoreRide() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const resActive = await fetch(`${API_URL}/api/rides/current`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        const dataActive = resActive.ok ? await resActive.json() : null;
        if (
          dataActive &&
          dataActive.rideId &&
          ["accepted", "in_progress", "pending"].includes(dataActive.rideStatus)
        ) {
          setActiveRide({
            id: dataActive.rideId,
            originLat: dataActive.originLat,
            originLng: dataActive.originLng,
            destLat: dataActive.destLat,
            destLng: dataActive.destLng,
            vehicleType: dataActive.vehicleType,
            status: dataActive.rideStatus,
            driver: dataActive.driver,
            scheduledAt: dataActive.scheduledAt,
            note: dataActive.note,
            destinationName: dataActive.destinationName,
          });
          setPickupSet(true);
          setDriverInfo(dataActive.driver);
          setPickupLocation({ lat: dataActive.originLat, lng: dataActive.originLng });
          setDestination({ lat: dataActive.destLat, lng: dataActive.destLng });
          setDestinationName(dataActive.destinationName || "");
          setRideId(dataActive.rideId);
          setRideStatus(dataActive.rideStatus);
        } else {
          setActiveRide(null);
          setRideId(null);
          setRideStatus(null);
        }
      } catch (e) {
        setActiveRide(null);
      }
    }
    restoreRide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // --- Ensure pickupLocation always set if possible
  useEffect(() => {
    if (!pickupLocation && userLocation) {
      setPickupLocation(userLocation);
    }
  }, [pickupLocation, userLocation]);

  // GEOLOCATION
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        setUserLocation(loc);
        setPickupLocation(loc);
      },
      () => {
        const loc = { lng: 31.2357, lat: 30.0444 };
        setUserLocation(loc);
        setPickupLocation(loc);
      }
    );
  }, []);

  // EMERGENCY LOCATIONS
  useEffect(() => {
    if (!userLocation) return;
    const lat = userLocation.lat;
    const lng = userLocation.lng;
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"="hospital"](around:5000,${lat},${lng});
      node["amenity"="police"](around:5000,${lat},${lng});
      node["emergency"="fire_station"](around:5000,${lat},${lng});
      );
      out body;
    `;
    const url = "https://overpass-api.de/api/interpreter";
    fetch(url, {
      method: "POST",
      body: query,
      headers: { "Content-Type": "text/plain" }
    })
      .then(res => res.json())
      .then((data: { elements: OverpassElement[] }) => {
        const locations: EmergencyLocation[] = [];
        for (const el of data.elements) {
          if (!el.lat || !el.lon) continue;
          let type: EmergencyLocation["type"] | undefined;
          let icon: string | undefined;
          if (el.tags.amenity === "hospital") {
            type = "hospital";
            icon = hospitalIcon;
          } else if (el.tags.amenity === "police") {
            type = "police";
            icon = policeIcon;
          } else if (el.tags.emergency === "fire_station") {
            type = "fire";
            icon = fireIcon;
          }
          if (type && icon) {
            locations.push({
              type,
              name: el.tags.name || (type.charAt(0).toUpperCase() + type.slice(1)),
              lat: el.lat,
              lng: el.lon,
              phone: el.tags.phone,
              icon
            });
          }
        }
        setEmergencyLocations(locations);
      })
      .catch(() => {});
  }, [userLocation]);

  // POLLING ACTIVE RIDE STATUS (with chat open on accept)
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (activeRide && ["pending", "accepted", "in_progress"].includes(activeRide.status || "")) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/rides/${activeRide.id}/status`);
          const data = await res.json();
          if (data.status) setRideStatus(data.status);

          // Detect transition from pending to accepted/in_progress
          if (
            (activeRide.status === "pending" && (data.status === "accepted" || data.status === "in_progress")) ||
            (activeRide.status === "accepted" && data.status === "in_progress")
          ) {
            setChatOpen(true);
          }
          // Reset chat if ride is done/cancelled
          if (data.status === "done" || data.status === "cancelled" || data.status === "no_show") {
            setChatOpen(false);
            setLastFinishedRideId(activeRide.id);
            setShowRating(true);
            resetRegularRide();
          }
        } catch (err) {}
      }, 3000);
    }
    return () => interval && clearInterval(interval);
  }, [activeRide]);

  // Also: If page is loaded and ride is already accepted/in_progress, open chat
  useEffect(() => {
    if (
      activeRide &&
      (activeRide.status === "accepted" || activeRide.status === "in_progress")
    ) {
      setChatOpen(true);
    }
  }, [activeRide?.status]);

  // Save previous status to handle transitions on reloads
  useEffect(() => {
    setPrevRideStatus(activeRide?.status ?? null);
  }, [activeRide?.status]);

  // --- REQUEST RIDE (REGULAR)
  async function handleRequestRide() {
    if (!pickupLocation || !destination || !vehicleType || !destinationName) {
      setError("Pickup, destination, destination name, and vehicle type required.");
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
    setWaiting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/rides/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId,
          originLat: pickupLocation.lat,
          originLng: pickupLocation.lng,
          destLat: destination.lat,
          destLng: destination.lng,
          destinationName,
          vehicleType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create ride.");
        setWaiting(false);
        return;
      }
      setActiveRide({
        id: data.rideId || data.id,
        originLat: pickupLocation.lat,
        originLng: pickupLocation.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        vehicleType,
        status: "pending",
        destinationName,
      });
      setPickupSet(true);
      setRideId(data.rideId || data.id);
      setRideStatus("pending");
      setWaiting(false);
      setShowRating(false); // New ride, hide rating
      setLastFinishedRideId(null);
    } catch (err: any) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  // --- CANCEL RIDE
  async function handleCancelRide(rideIdToCancel: number) {
    setWaiting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/rides/${rideIdToCancel}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to cancel ride.");
        setWaiting(false);
        return;
      }
      setChatOpen(false);
      setLastFinishedRideId(rideIdToCancel);
      setShowRating(true);
      resetRegularRide();
      setWaiting(false);
    } catch (err) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  // --- UI

  // 1. If active ride (pending/accepted/in_progress)
  if (activeRide && ["pending", "accepted", "in_progress"].includes(activeRide.status || "")) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        {activeRide.status === "pending" && (
          <>
            <h2>Ride Requested</h2>
            <div style={{ margin: 10 }}>Waiting for a driver to accept your ride...</div>
            <button
              style={{
                background: "#f44336",
                color: "#fff",
                border: "none",
                padding: "0.7em 1.4em",
                borderRadius: 6,
                fontSize: 16,
                margin: "14px 0 8px 0"
              }}
              onClick={() => handleCancelRide(activeRide.id)}
              disabled={waiting}
            >
              Cancel Ride
            </button>
          </>
        )}
        {(activeRide.status === "accepted" || activeRide.status === "in_progress") && (
          <>
            <h2>{activeRide.status === "accepted" ? "Driver Accepted" : "On Trip"}</h2>
            <div style={{ margin: 10 }}>
              <b>Driver:</b> {activeRide.driver?.name || "Assigned driver"} <br />
              <b>Vehicle:</b> {activeRide.driver?.vehicleType || activeRide.vehicleType}
            </div>
            <button
              style={{
                background: "#f44336",
                color: "#fff",
                border: "none",
                padding: "0.7em 1.4em",
                borderRadius: 6,
                fontSize: 16,
                margin: "14px 0 8px 0"
              }}
              onClick={() => handleCancelRide(activeRide.id)}
              disabled={waiting}
            >
              Cancel Ride
            </button>
            {chatOpen && (
              <RestChatWindow rideId={activeRide.id} userType="customer" />
            )}
          </>
        )}
      </div>
    );
  }

  // 2. After ride is done/cancelled, show rating and allow new ride request
  if (showRating && lastFinishedRideId) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <RateDriver
          rideId={lastFinishedRideId}
          onRated={() => {
            setShowRating(false);
            setLastFinishedRideId(null);
            resetAll();
          }}
        />
        <button
          style={{ marginTop: 24, background: "#1976D2", color: "#fff", fontWeight: "bold", fontSize: 18, padding: "0.8em 2em", borderRadius: 6, border: "none" }}
          onClick={() => {
            setShowRating(false);
            setLastFinishedRideId(null);
            resetAll();
          }}
        >
          Request New Ride
        </button>
      </div>
    );
  }

  // 3. Main homepage UI
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ textAlign: "center" }}>
        Xzity Ride Request
      </h2>
      {error && <div style={{ color: "#d32f2f", textAlign: "center" }}>{error}</div>}
      {userLocation && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{ height: 320, borderRadius: 8, margin: "0 auto", width: "100%", maxWidth: 640 }}
          whenCreated={map => {
            map.on("click", (e: any) => {
              if (!pickupSet) {
                setPickupLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
                setPickupSet(true);
              } else {
                setDestination({ lat: e.latlng.lat, lng: e.latlng.lng });
              }
            });
          }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {pickupLocation && (
            <Marker
              position={[pickupLocation.lat, pickupLocation.lng]}
              icon={createLeafletIcon(markerCustomer, 32, 41)}
            >
              <Popup>Pickup Here</Popup>
            </Marker>
          )}
          {destination && (
            <Marker
              position={[destination.lat, destination.lng]}
              icon={createLeafletIcon(markerCustomer, 32, 41)}
            >
              <Popup>Destination</Popup>
            </Marker>
          )}
          {emergencyLocations.map((em, idx) => (
            <Marker
              key={idx}
              position={[em.lat, em.lng]}
              icon={createEmergencyIcon(em.icon)}
            >
              <Popup>
                <div>
                  <strong>{em.name}</strong> <br />
                  <span style={{ textTransform: "capitalize" }}>{em.type}</span>
                  {em.phone && (
                    <>
                      <br />
                      <a href={`tel:${em.phone}`} style={{ color: "#1976D2", textDecoration: "none" }}>
                        📞 Call: {em.phone}
                      </a>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      )}
      <div style={{ margin: "24px 0", textAlign: "center" }}>
        <label>
          <b>Vehicle Type:</b>
        </label>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
          {vehicleOptions.filter(opt => opt.value !== "").map(opt => (
            <button
              key={opt.value}
              onClick={() => setVehicleType(opt.value)}
              type="button"
              style={{
                border: vehicleType === opt.value ? "2px solid #1976D2" : "2px solid #ccc",
                background: vehicleType === opt.value ? "#e6f0ff" : "#fff",
                borderRadius: 8,
                padding: "14px 18px",
                margin: 2,
                minWidth: 90,
                minHeight: 70,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                outline: "none",
                boxShadow: vehicleType === opt.value ? "0 0 8px #1976D2" : "0 1px 3px #eee",
                fontWeight: vehicleType === opt.value ? "bold" : "normal",
                fontSize: "1.05em"
              }}
            >
              <img src={opt.icon} alt={opt.label} style={{ width: 24, height: 24, marginBottom: 3 }} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ margin: "24px 0", textAlign: "center", display: "flex", justifyContent: "center", gap: 20 }}>
        <button
          disabled={waiting || !pickupLocation || !destination || !vehicleType || !destinationName}
          onClick={handleRequestRide}
          style={{
            background: "#388e3c",
            color: "#fff",
            border: "none",
            padding: "0.9em 2em",
            borderRadius: 6,
            fontSize: 18,
            fontWeight: "bold",
            opacity: waiting ? 0.7 : 1
          }}
        >
          Request Ride
        </button>
      </div>
      {pickupLocation && (
        <div style={{ textAlign: "center", color: "#888" }}>
          Pickup Location: {pickupLocation.lat.toFixed(4)}, {pickupLocation.lng.toFixed(4)}
        </div>
      )}
      {destination && (
        <div style={{ textAlign: "center", color: "#888" }}>
          Destination: {destination.lat.toFixed(4)}, {destination.lng.toFixed(4)}
        </div>
      )}
      <div style={{ margin: "10px auto", textAlign: "center" }}>
        <input
          type="text"
          value={destinationName}
          onChange={e => setDestinationName(e.target.value)}
          placeholder="Type destination (e.g. Airport, Hospital)"
          style={{ width: 260, padding: 6, borderRadius: 5, border: "1px solid #ccc" }}
        />
        <div style={{ fontSize: 13, color: "#888" }}>
          Click map to set pickup, then click again to set destination. Type the destination name for clarity.
        </div>
      </div>
    </div>
  );
}
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
import RestChatWindow from "../components/RestChatWindow"; // REST polling chat

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

type RideStatus = "pending" | "accepted" | "in_progress" | "done" | "cancelled" | "scheduled" | null;
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

function RateDriver({ rideId, onRated }: { rideId: number, onRated: () => void }) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
    : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`${API_URL}/api/rides/${rideId}/rate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, feedback }),
    });
    setSubmitting(false);
    onRated();
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

function saveChatSession(rideId: number | null, rideStatus: RideStatus) {
  localStorage.setItem("currentRideId", rideId ? String(rideId) : "");
  localStorage.setItem("currentRideStatus", rideStatus || "");
}
function getSavedChatSession() {
  const rideId = Number(localStorage.getItem("currentRideId"));
  const rideStatus = localStorage.getItem("currentRideStatus");
  return { rideId: rideId || null, rideStatus: rideStatus || null };
}

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

export default function CustomerDashboard() {
  // ------------------- STATE -------------------
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupSet, setPickupSet] = useState(false);
  const [rideId, setRideId] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [showDoneActions, setShowDoneActions] = useState(false);
  const [emergencyLocations, setEmergencyLocations] = useState<EmergencyLocation[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // --- Scheduled Ride Modal State ---
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduledVehicleType, setScheduledVehicleType] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [scheduledDestinationName, setScheduledDestinationName] = useState<string>("");
  const [scheduledNote, setScheduledNote] = useState<string>("");
  const [scheduledDestLocation, setScheduledDestLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [scheduledRideId, setScheduledRideId] = useState<number | null>(null);
  const [scheduledStatus, setScheduledStatus] = useState<RideStatus>(null);
  const [scheduledError, setScheduledError] = useState<string | null>(null);
  const [scheduledWaiting, setScheduledWaiting] = useState(false);

  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    async function restoreCurrentRideFromBackend() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/rides/current`, {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.rideId && ["accepted", "in_progress", "pending"].includes(data.rideStatus)) {
            setRideId(data.rideId);
            setRideStatus(data.rideStatus);
            setPickupSet(true);
            if (data.driver) setDriverInfo(data.driver);
            if (data.originLat && data.originLng) {
              setPickupLocation({ lat: data.originLat, lng: data.originLng });
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }
    if (!rideId && !pickupSet) {
      restoreCurrentRideFromBackend();
    }
  }, [rideId, pickupSet]);

  useEffect(() => {
    if (rideId && rideStatus) saveChatSession(rideId, rideStatus);
  }, [rideId, rideStatus]);

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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pickupSet && rideId && rideStatus !== "done" && rideStatus !== "cancelled") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`${API_URL}/api/rides/${rideId}/status`);
          const data = await res.json();
          if (data.status) setRideStatus(data.status);
          if ((data.status === "accepted" || data.status === "in_progress") && data.driver) {
            setDriverInfo({
              name: data.driver.name || "",
              vehicleType: data.driver.vehicleType || ""
            });
          }
        } catch (err) {}
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [pickupSet, rideId, rideStatus]);

  async function handleRequestRide() {
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
    setWaiting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/rides/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          customerId,
          originLat: pickupLocation.lat,
          originLng: pickupLocation.lng,
          destLat: pickupLocation.lat,
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
      setRideId(data.rideId || data.id);
      setRideStatus("pending");
      setWaiting(false);
    } catch (err: any) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  // --- SCHEDULED RIDE LOGIC WITH DESTINATION FIELD & NOTE FIELD ---
  function openScheduleModal() {
    setScheduledVehicleType("");
    setScheduledDate("");
    setScheduledTime("");
    setScheduledDestinationName("");
    setScheduledNote("");
    setScheduledDestLocation(null);
    setScheduledRideId(null);
    setScheduledStatus(null);
    setScheduledError(null);
    setShowScheduleModal(true);
  }
  function closeScheduleModal() {
    setShowScheduleModal(false);
    setScheduledWaiting(false);
    setScheduledError(null);
    setScheduledRideId(null);
    setScheduledStatus(null);
  }

  async function handleScheduleRide() {
    if (
      !pickupLocation ||
      !scheduledVehicleType ||
      !scheduledDate ||
      !scheduledTime ||
      !scheduledDestinationName
    ) {
      setScheduledError("All fields required.");
      return;
    }
    const token = localStorage.getItem("token");
    const customerId = getCustomerIdFromStorage();
    if (!token || customerId === null) {
      setScheduledError("Not logged in.");
      return;
    }
    const scheduleDateTime = new Date(`${scheduledDate}T${scheduledTime}`);
    if (scheduleDateTime < new Date()) {
      setScheduledError("Scheduled time must be in the future.");
      return;
    }
    let destLat = pickupLocation.lat;
    let destLng = pickupLocation.lng;
    if (scheduledDestLocation) {
      destLat = scheduledDestLocation.lat;
      destLng = scheduledDestLocation.lng;
    }
    setScheduledWaiting(true);
    setScheduledError(null);
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
          destLat,
          destLng,
          destinationName: scheduledDestinationName,
          note: scheduledNote,
          vehicleType: scheduledVehicleType,
          scheduledAt: scheduleDateTime.toISOString()
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScheduledError(data.error || "Failed to schedule ride.");
        setScheduledWaiting(false);
        return;
      }
      setScheduledRideId(data.rideId || data.id);
      setScheduledStatus("scheduled");
      setScheduledWaiting(false);
    } catch (err: any) {
      setScheduledError("Network or server error.");
      setScheduledWaiting(false);
    }
  }

  function handleScheduleMapClick(e: any) {
    setScheduledDestLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
  }

  async function handleCancelScheduledRide() {
    if (!scheduledRideId) return;
    setScheduledWaiting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/rides/${scheduledRideId}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        }
      });
      if (!res.ok) {
        const data = await res.json();
        setScheduledError(data.error || "Failed to cancel scheduled ride.");
        setScheduledWaiting(false);
        return;
      }
      setScheduledStatus("cancelled");
      setScheduledWaiting(false);
    } catch (err) {
      setScheduledError("Network or server error.");
      setScheduledWaiting(false);
    }
  }

  async function handleCancelRide() {
    if (!rideId) return;
    setWaiting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/rides/${rideId}/cancel`, {
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
      setRideStatus("cancelled");
      setWaiting(false);
    } catch (err) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  async function handleMarkAsDone() {
    if (!rideId) return;
    setWaiting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/api/rides/${rideId}/done`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
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
    } finally {
      setWaiting(false);
    }
  }

  function handleReset() {
    setRideStatus(null);
    setPickupSet(false);
    setPickupLocation(userLocation);
    setVehicleType("");
    setRideId(null);
    setDriverInfo(null);
    setShowDoneActions(false);
    setChatMessages([]);
    saveChatSession(null, null);
  }

  useEffect(() => {
    if (!rideId || !(rideStatus === "accepted" || rideStatus === "in_progress")) return;
    let polling = true;
    async function fetchMessages() {
      if (!polling) return;
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${API_URL}/api/rides/${rideId}/chat/messages`, {
          headers: token ? { "Authorization": `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const msgs = await res.json();
          setChatMessages(
            Array.isArray(msgs)
              ? msgs.filter(Boolean).map((m, idx) => ({
                  ...m,
                  id: m?.id || m?._id || m?.timestamp || `${Date.now()}_${idx}`,
                  sender: m?.sender ?? {
                    id: m?.senderId ?? "unknown",
                    name: m?.senderName ?? "",
                    role: m?.senderRole ?? "",
                    avatar: m?.senderAvatar ?? "",
                  },
                }))
              : []
          );
        } else {
          setChatMessages([]);
        }
      } catch {
        setChatMessages([]);
      }
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => {
      polling = false;
      clearInterval(interval);
    };
  }, [rideId, rideStatus]);

  const handleSendMessage = async (text: string) => {
    const customerId = getCustomerIdFromStorage();
    if (!rideId || !customerId) return;
    await fetch(`${API_URL}/api/rides/${rideId}/chat/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sender: {
          id: customerId,
          name: "Customer",
          role: "customer",
          avatar: "",
        },
        content: text,
      }),
    });
  };

  // --- Scheduled ride modal content with destination and note fields
  function renderScheduleModal() {
    if (!showScheduleModal) return null;
    if (scheduledStatus === "scheduled" && scheduledRideId) {
      return (
        <div style={modalStyle}>
          <div style={modalBoxStyle}>
            <h3>Ride Scheduled!</h3>
            <div>We'll assign you a driver before your selected time.</div>
            <div style={{ margin: "12px 0", fontSize: 15 }}>
              <b>Pickup:</b> {pickupLocation?.lat?.toFixed(4)}, {pickupLocation?.lng?.toFixed(4)}
              <br />
              <b>Vehicle:</b> {scheduledVehicleType}
              <br />
              <b>Date:</b> {scheduledDate} <b>Time:</b> {scheduledTime}
              <br />
              <b>Destination:</b> {scheduledDestinationName}
              {scheduledDestLocation && (
                <>
                  <br />
                  <b>Dest. Coords:</b> {scheduledDestLocation.lat.toFixed(4)}, {scheduledDestLocation.lng.toFixed(4)}
                </>
              )}
              {scheduledNote && (
                <>
                  <br />
                  <b>Note:</b> {scheduledNote}
                </>
              )}
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
              onClick={handleCancelScheduledRide}
              disabled={scheduledWaiting}
            >
              Cancel Scheduled Ride
            </button>
            <button
              style={{ background: "#1976D2", color: "#fff", border: "none", padding: "0.7em 1.4em", borderRadius: 6, fontSize: 16 }}
              onClick={closeScheduleModal}
            >
              Close
            </button>
            {scheduledStatus === "cancelled" && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>Scheduled ride cancelled.</div>
            )}
          </div>
        </div>
      );
    }
    return (
      <div style={modalStyle}>
        <div style={modalBoxStyle}>
          <h3>Schedule a Ride</h3>
          <div style={{ fontSize: 14, marginBottom: 12 }}>Select vehicle, date, time, and destination for your future ride.</div>
          <div style={{ marginBottom: 8 }}>
            <label>Vehicle Type:</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
              {vehicleOptions.filter(opt => opt.value !== "").map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setScheduledVehicleType(opt.value)}
                  type="button"
                  style={{
                    border: scheduledVehicleType === opt.value ? "2px solid #1976D2" : "2px solid #ccc",
                    background: scheduledVehicleType === opt.value ? "#e6f0ff" : "#fff",
                    borderRadius: 8,
                    padding: "10px 14px",
                    minWidth: 70,
                    minHeight: 50,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow: scheduledVehicleType === opt.value ? "0 0 8px #1976D2" : "0 1px 3px #eee",
                    fontWeight: scheduledVehicleType === opt.value ? "bold" : "normal",
                    fontSize: "1em"
                  }}
                >
                  <img src={opt.icon} alt={opt.label} style={{ width: 22, height: 22, marginBottom: 3 }} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Date:</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              style={{ marginLeft: 12, fontSize: 16, padding: "3px 5px" }}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Time:</label>
            <input
              type="time"
              value={scheduledTime}
              onChange={e => setScheduledTime(e.target.value)}
              style={{ marginLeft: 12, fontSize: 16, padding: "3px 5px" }}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Destination:</label>
            <input
              type="text"
              value={scheduledDestinationName}
              onChange={e => setScheduledDestinationName(e.target.value)}
              placeholder="Enter destination (e.g., Airport, Mall, Home...)"
              style={{ marginLeft: 12, fontSize: 16, padding: "3px 5px", width: 200 }}
              autoComplete="off"
              required
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <label>Special Instructions:</label>
            <textarea
              value={scheduledNote}
              onChange={e => setScheduledNote(e.target.value)}
              placeholder="Any special instructions? (e.g., 'Need help with luggage', 'Big trunk', etc.)"
              style={{ marginLeft: 12, fontSize: 15, padding: "3px 5px", width: 220, minHeight: 40, resize: "vertical" }}
              rows={2}
              maxLength={200}
            />
          </div>
          <div style={{ marginBottom: 10, width: "95%" }}>
            <label style={{ display: "block", marginBottom: 2 }}>Drop a pin on the map for your destination (optional):</label>
            <MapContainer
              center={pickupLocation || { lat: 30.0444, lng: 31.2357 }}
              zoom={13}
              style={{ height: 200, borderRadius: 8, width: "100%" }}
              whenCreated={map => {
                map.on("click", handleScheduleMapClick);
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
              {scheduledDestLocation && (
                <Marker
                  position={[scheduledDestLocation.lat, scheduledDestLocation.lng]}
                  icon={createLeafletIcon(deliveryIcon, 32, 41)}
                >
                  <Popup>Destination Here</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
          <button
            style={{
              background: "#388e3c",
              color: "#fff",
              border: "none",
              padding: "0.8em 1.8em",
              borderRadius: 6,
              fontSize: 17,
              fontWeight: "bold",
              marginBottom: 8,
              opacity: scheduledWaiting ? 0.7 : 1
            }}
            onClick={handleScheduleRide}
            disabled={
              scheduledWaiting ||
              !scheduledVehicleType ||
              !scheduledDate ||
              !scheduledTime ||
              !scheduledDestinationName
            }
          >
            Schedule Ride
          </button>
          <button
            style={{ background: "#1976D2", color: "#fff", border: "none", padding: "0.6em 1.1em", borderRadius: 6, fontSize: 16 }}
            onClick={closeScheduleModal}
          >
            Cancel
          </button>
          {scheduledError && <div style={{ color: "#d32f2f", marginTop: 8 }}>{scheduledError}</div>}
        </div>
      </div>
    );
  }

  // --- modalStyle/modalBoxStyle used above
  const modalStyle: React.CSSProperties = {
    position: "fixed",
    left: 0,
    top: 0,
    width: "100vw",
    height: "100vh",
    background: "rgba(0,0,0,0.18)",
    zIndex: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  };

  const modalBoxStyle: React.CSSProperties = {
    background: "#fff",
    borderRadius: 10,
    boxShadow: "0 4px 16px #5558",
    padding: "28px 32px",
    minWidth: 320,
    maxWidth: 390,
    display: "flex",
    flexDirection: "column",
    alignItems: "center"
  };

  // --- Active ride UI, completed/cancelled UI, main request/schedule UI (unchanged) ---

  // ... rest of the component logic and rendering (as in your current file) ...

  // The rest of the file remains unchanged, except that renderScheduleModal is now as above.

  // Main render (unchanged except for scheduled modal)
  if (
    (rideStatus === "pending" && pickupSet && rideId) ||
    (rideStatus === "accepted" || rideStatus === "in_progress")
  ) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        {/* ... unchanged ... */}
      </div>
    );
  }

  if (showScheduleModal) {
    return (
      <>
        <div style={{ padding: 24, opacity: 0.45, pointerEvents: "none" }}>
          {/* ... unchanged ... */}
        </div>
        {renderScheduleModal()}
      </>
    );
  }

  if (rideStatus === "done" && showDoneActions && rideId) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        {/* ... unchanged ... */}
      </div>
    );
  }

  if (rideStatus === "cancelled") {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        {/* ... unchanged ... */}
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {/* ... unchanged ... */}
      {renderScheduleModal()}
    </div>
  );
}
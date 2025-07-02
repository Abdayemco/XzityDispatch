import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerCustomer from "../assets/marker-customer.png";
import carIcon from "../assets/marker-car.png";
import deliveryIcon from "../assets/marker-delivery.png";
import tuktukIcon from "../assets/marker-toktok.png";
import truckIcon from "../assets/marker-truck.png";
import waterTruckIcon from "../assets/marker-watertruck.png";
import fireIcon from "../assets/emergency-fire.png";
import policeIcon from "../assets/emergency-police.png";
import hospitalIcon from "../assets/emergency-hospital.png";
import ChatWindow from "../components/ChatWindow";
import { io } from "socket.io-client";

// Utility: Get icon URL for a given vehicleType (enum values)
function getVehicleIcon(vehicleType: string) {
  switch (vehicleType) {
    case "CAR": return carIcon;
    case "DELIVERY": return deliveryIcon;
    case "TUKTUK": return tuktukIcon;
    case "TRUCK": return truckIcon;
    case "WATER_TRUCK": return waterTruckIcon;
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

// Create a Leaflet emergency icon
function createEmergencyIcon(url: string) {
  return L.icon({
    iconUrl: url,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
    shadowUrl: undefined,
  });
}

// Updated dropdown options: DELIVERY uses deliveryIcon
const vehicleOptions = [
  { value: "", label: "Select type", icon: "" },
  { value: "CAR", label: "Car", icon: carIcon },
  { value: "DELIVERY", label: "Delivery", icon: deliveryIcon },
  { value: "TUKTUK", label: "Tuktuk", icon: tuktukIcon },
  { value: "TRUCK", label: "Truck", icon: truckIcon },
  { value: "WATER_TRUCK", label: "Water Truck", icon: waterTruckIcon }
];

function getCustomerIdFromStorage(): number | null {
  const raw = localStorage.getItem("userId");
  if (!raw) return null;
  const parsed = Number(raw);
  return !isNaN(parsed) && Number.isInteger(parsed) ? parsed : null;
}

type RideStatus = "pending" | "accepted" | "in_progress" | "done" | "cancelled" | null;
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch(`/api/rides/${rideId}/rate`, {
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

// VITE COMPATIBLE SOCKET URL (no process.env!)
const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000");

export default function CustomerDashboard() {
  // ------------------- STATE -------------------
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

  // ------------------- GEOLOCATION -------------------
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

  // ------------------- EMERGENCY LOCATIONS -------------------
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

  // ------------------- POLLING RIDE STATUS -------------------
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (pickupSet && rideId && rideStatus !== "done" && rideStatus !== "cancelled") {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/rides/${rideId}/status`);
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

  // ------------------- REQUEST RIDE -------------------
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
      const res = await fetch("/api/rides/request", {
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

  // ------------------- CANCEL RIDE -------------------
  async function handleCancelRide() {
    if (!rideId) return;
    setWaiting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/rides/${rideId}/cancel`, {
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

  // ------------------- MARK AS DONE -------------------
  async function handleMarkAsDone() {
    if (!rideId) return;
    setWaiting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/rides/${rideId}/done`, {
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
  }

  // ------------------- CHAT LOGIC -------------------
  useEffect(() => {
    if (!rideId || !(rideStatus === "accepted" || rideStatus === "in_progress")) return;
    // Fetch chat messages on ride accepted/in_progress
    const fetchMessages = async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/chats/${rideId}/messages`, {
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
    };
    fetchMessages();
    return () => setChatMessages([]);
  }, [rideId, rideStatus]);

  useEffect(() => {
    if (!rideId || !(rideStatus === "accepted" || rideStatus === "in_progress")) return;
    socket.emit("join_chat", { chatId: rideId });
    const handleIncoming = (msg: any) => {
      // Defensive: Normalize sender field for incoming socket messages
      let normalizedMsg = {
        ...msg,
        sender: msg.sender ?? {
          id: msg.senderId ?? "unknown",
          name: msg.senderName ?? "",
          role: msg.senderRole ?? "",
          avatar: msg.senderAvatar ?? "",
        },
      };
      setChatMessages(prev => prev.some(m => m.id === normalizedMsg.id) ? prev : [...prev, normalizedMsg]);
    };
    socket.on("chat_message", handleIncoming);
    return () => {
      socket.off("chat_message", handleIncoming);
      socket.emit("leave_chat", { chatId: rideId });
    };
  }, [rideId, rideStatus]);

  // --- Send message handler (optimistic update) ---
  const handleSendMessage = (text: string) => {
    const customerId = getCustomerIdFromStorage();
    if (!rideId || !customerId) return;
    const msg = {
      id: Date.now() + Math.random(),
      chatId: rideId,
      senderId: customerId,
      senderRole: "customer",
      senderName: "Customer",
      content: text,
      sentAt: new Date().toISOString(),
    };
    setChatMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, {
      ...msg,
      sender: {
        id: msg.senderId,
        name: msg.senderName,
        role: msg.senderRole,
        avatar: "",
      },
    }]);
    socket.emit("chat_message", msg);
  };

  // ------------------- UI RENDERING -------------------
  if (
    (rideStatus === "pending" && pickupSet && rideId) ||
    (rideStatus === "accepted" || rideStatus === "in_progress")
  ) {
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
        {(rideStatus === "accepted" || rideStatus === "in_progress") && rideId && (
          <div style={{
            margin: "32px auto",
            display: "flex",
            justifyContent: "center",
            height: "250px",
            maxHeight: "250px",
            minHeight: "120px",
            width: "100%",
            maxWidth: "500px",
            background: "#fff",
            boxShadow: "0 0 6px #ddd"
          }}>
            <ChatWindow
              rideId={rideId}
              senderId={getCustomerIdFromStorage()!}
              messages={chatMessages}
              currentUserId={getCustomerIdFromStorage()!}
              currentUserRole="customer"
              onSend={handleSendMessage}
              style={{ height: "100%" }}
            />
          </div>
        )}
        {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      </div>
    );
  }

  if (rideStatus === "done" && showDoneActions && rideId) {
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
          style={{ background: "#1976D2", color: "#fff", border: "none", padding: "0.7em 1.4em", borderRadius: 6, fontSize: 16 }}
          onClick={handleReset}
        >
          Request New Ride
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ textAlign: "center" }}>Request a Ride</h2>
      {error && <div style={{ color: "#d32f2f", textAlign: "center" }}>{error}</div>}
      {userLocation && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{ height: 320, borderRadius: 8, margin: "0 auto", width: "100%", maxWidth: 640 }}
          whenCreated={map => {
            map.on("click", (e: any) => {
              setPickupLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
              setPickupSet(true);
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
          <select
            value={vehicleType}
            onChange={e => setVehicleType(e.target.value)}
            style={{ marginLeft: 12, fontSize: 16 }}
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
        </label>
      </div>
      <div style={{ margin: "24px 0", textAlign: "center" }}>
        <button
          disabled={waiting || !pickupLocation || !vehicleType}
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
    </div>
  );
}
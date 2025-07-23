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
import towTruckIcon from "../assets/marker-towtruck.png";
import wheelchairIcon from "../assets/marker-wheelchair.png";
import fireIcon from "../assets/emergency-fire.png";
import policeIcon from "../assets/emergency-police.png";
import hospitalIcon from "../assets/emergency-hospital.png";
import RestChatWindow from "../components/RestChatWindow";
import { DateTime } from "luxon";

// VEHICLE OPTIONS
const vehicleOptions = [
  { value: "CAR", label: "Car", icon: carIcon },
  { value: "DELIVERY", label: "Delivery", icon: deliveryIcon },
  { value: "TUKTUK", label: "Tuktuk", icon: tuktukIcon },
  { value: "TRUCK", label: "Truck", icon: truckIcon },
  { value: "WATER_TRUCK", label: "Water Truck", icon: waterTruckIcon },
  { value: "TOW_TRUCK", label: "Tow Truck", icon: towTruckIcon },
  { value: "WHEELCHAIR", label: "Wheelchair", icon: wheelchairIcon }
];

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
type Ride = {
  id: number;
  scheduledAt: string;
  vehicleType: string;
  destinationName: string;
  note: string;
  status: RideStatus;
  driver?: DriverInfo;
  rated?: boolean;
};

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

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

export default function CustomerDashboard() {
  // --- STATE ---
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [userLocation, setUserLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{ lng: number; lat: number } | null>(null);
  const [vehicleType, setVehicleType] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rides State: all customer rides
  const [rides, setRides] = useState<Ride[]>([]);
  // For modal
  const [modalState, setModalState] = useState<{open: boolean, edit: boolean, ride?: Ride}>({open: false, edit: false});
  const [formVehicleType, setFormVehicleType] = useState<string>("");
  const [formDestinationName, setFormDestinationName] = useState<string>("");
  const [formDatetime, setFormDatetime] = useState<string>("");
  const [formNote, setFormNote] = useState<string>("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formWaiting, setFormWaiting] = useState(false);

  // Chat state per ride
  const [chatMessages, setChatMessages] = useState<{[rideId: number]: any[]}>({});
  const [activeChats, setActiveChats] = useState<{[rideId: number]: boolean}>({});
  const [ratingState, setRatingState] = useState<{[rideId: number]: boolean}>({});

  // Timezone detection for pickup location
  const [pickupTimeZone, setPickupTimeZone] = useState<string>("UTC");
  const [localTime, setLocalTime] = useState<string>("");

  // Emergency locations
  const [emergencyLocations, setEmergencyLocations] = useState<EmergencyLocation[]>([]);

  // --- EFFECTS ---
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
    // Fetch all rides for customer: scheduled + active + done
    async function fetchAllRides() {
      const customerId = getCustomerIdFromStorage();
      if (!customerId) return;
      try {
        const res = await fetch(`${API_URL}/api/rides/all?customerId=${customerId}`, {
          headers: { "Authorization": token ? `Bearer ${token}` : "" }
        });
        if (res.ok) {
          const rides: Ride[] = await res.json();
          setRides(
            rides
              .filter(r => r.status !== "cancelled")
              .sort((a, b) => DateTime.fromISO(a.scheduledAt).toMillis() - DateTime.fromISO(b.scheduledAt).toMillis())
          );
        }
      } catch {}
    }
    fetchAllRides();
    const interval = setInterval(fetchAllRides, 5000);
    return () => clearInterval(interval);
  }, [token, modalState.open]);

  useEffect(() => {
    if (pickupLocation && pickupLocation.lat && pickupLocation.lng) {
      const apiKey = import.meta.env.VITE_TIMEZONEDB_API_KEY;
      if (!apiKey) return setPickupTimeZone("UTC");
      fetch(
        `https://api.timezonedb.com/v2.1/get-time-zone?key=${apiKey}&format=json&by=position&lat=${pickupLocation.lat}&lng=${pickupLocation.lng}`
      )
        .then(res => res.json())
        .then(data => setPickupTimeZone(data.zoneName || "UTC"))
        .catch(() => setPickupTimeZone("UTC"));
    }
  }, [pickupLocation]);

  useEffect(() => {
    const timer = setInterval(() => {
      const nowUtc = DateTime.utc();
      const local = pickupTimeZone
        ? nowUtc.setZone(pickupTimeZone).toFormat("yyyy-MM-dd HH:mm:ss")
        : nowUtc.toFormat("yyyy-MM-dd HH:mm:ss");
      setLocalTime(local);
    }, 1000);
    return () => clearInterval(timer);
  }, [pickupTimeZone]);

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

  // Per-ride chat polling
  useEffect(() => {
    const intervals: {[rideId: number]: NodeJS.Timeout} = {};
    rides.forEach(ride => {
      if (["accepted","in_progress"].includes(ride.status)) {
        if (!activeChats[ride.id]) setActiveChats(prev => ({...prev, [ride.id]: true}));
        const fetchMessages = async () => {
          try {
            const res = await fetch(`${API_URL}/api/rides/${ride.id}/chat/messages`, {
              headers: token ? { "Authorization": `Bearer ${token}` } : {},
            });
            if (res.ok) {
              const msgs = await res.json();
              setChatMessages(prev => ({
                ...prev,
                [ride.id]: Array.isArray(msgs)
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
              }));
            }
          } catch {}
        };
        fetchMessages();
        intervals[ride.id] = setInterval(fetchMessages, 3000);
      }
    });
    return () => {
      Object.values(intervals).forEach(clearInterval);
    };
  }, [rides, token, activeChats]);

  // --- Schedule Ride Modal Logic ---
  function openScheduleModal(edit: boolean, ride?: Ride) {
    if (edit && ride) {
      setModalState({open:true, edit:true, ride});
      setFormVehicleType(ride.vehicleType);
      setFormDestinationName(ride.destinationName);
      setFormDatetime(DateTime.fromISO(ride.scheduledAt).toFormat("yyyy-MM-dd'T'HH:mm"));
      setFormNote(ride.note || "");
    } else {
      setModalState({open:true, edit:false});
      setFormVehicleType("");
      setFormDestinationName("");
      setFormDatetime("");
      setFormNote("");
    }
    setFormError(null);
  }
  function closeScheduleModal() {
    setModalState({open:false, edit:false, ride:undefined});
    setFormError(null);
  }
  async function handleConfirmScheduledRide() {
    if (!userLocation || !formDatetime || !formDestinationName || !formVehicleType) {
      setFormError("All fields are required.");
      return;
    }
    const customerId = getCustomerIdFromStorage();
    if (!token || customerId === null) {
      setFormError("Not logged in.");
      return;
    }
    setFormWaiting(true);
    setFormError(null);

    const scheduledAtUTC = DateTime.fromISO(formDatetime, { zone: pickupTimeZone || "UTC" }).toUTC().toISO();

    try {
      let res, data;
      if (modalState.edit && modalState.ride) {
        res = await fetch(`${API_URL}/api/rides/schedule/${modalState.ride.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            customerId,
            originLat: userLocation.lat,
            originLng: userLocation.lng,
            destLat: userLocation.lat,
            destLng: userLocation.lng,
            vehicleType: formVehicleType,
            destinationName: formDestinationName,
            scheduledAt: scheduledAtUTC,
            note: formNote,
          }),
        });
      } else {
        res = await fetch(`${API_URL}/api/rides/schedule`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            customerId,
            originLat: userLocation.lat,
            originLng: userLocation.lng,
            destLat: userLocation.lat,
            destLng: userLocation.lng,
            vehicleType: formVehicleType,
            destinationName: formDestinationName,
            scheduledAt: scheduledAtUTC,
            note: formNote,
          }),
        });
      }
      data = await res.json();
      if (!res.ok) {
        setFormError(data.error || "Failed to schedule ride.");
        setFormWaiting(false);
        return;
      }
      closeScheduleModal();
      setFormWaiting(false);
    } catch (err: any) {
      setFormError("Network or server error.");
      setFormWaiting(false);
    }
  }

  async function handleCancelScheduledRide(ride: Ride) {
    setWaiting(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/rides/${ride.id}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel scheduled ride.");
        setWaiting(false);
        return;
      }
      setWaiting(false);
    } catch (err) {
      setError("Network or server error.");
      setWaiting(false);
    }
  }

  // --- Ride actions ---
  async function handleRequestRide() {
    if (!pickupLocation || !vehicleType) {
      setError("Pickup location and vehicle type required.");
      setWaiting(false);
      return;
    }
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      setWaiting(false);
    } catch (err: any) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  async function handleMarkRideDone(ride: Ride) {
    try {
      const res = await fetch(`${API_URL}/api/rides/${ride.id}/done`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
      });
      await res.json();
    } catch {}
  }

  // --- UI ---
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        Xzity Ride Request
      </h2>
      <div style={{ textAlign: "center", fontWeight: "bold", color: "#1976D2", fontSize: 17, marginBottom: 8 }}>
        {userLocation && pickupTimeZone && (
          <>Your current local time at pickup location: {localTime} {pickupTimeZone !== "UTC" ? `(${pickupTimeZone})` : ""}</>
        )}
      </div>
      {error && <div style={{ color: "#d32f2f", textAlign: "center" }}>{error}</div>}
      {userLocation && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{ height: 320, borderRadius: 8, margin: "0 auto", width: "100%", maxWidth: 640 }}
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
        </label>
        <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
          {vehicleOptions.map(opt => (
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
              <img src={opt.icon} alt={opt.label} style={{ width: 32, height: 32, marginBottom: 3 }} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ margin: "24px 0", textAlign: "center", display: "flex", justifyContent: "center", gap: 16 }}>
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
        <button
          style={{
            background: "#1976D2",
            color: "#fff",
            border: "none",
            padding: "0.9em 2em",
            borderRadius: 6,
            fontSize: 18,
            fontWeight: "bold"
          }}
          onClick={() => openScheduleModal(false)}
          disabled={waiting}
        >
          Schedule Ride
        </button>
      </div>
      {/* Scheduled rides list */}
      {rides.filter(r=>r.status==="scheduled").length > 0 && (
        <div style={{ margin: "30px 0" }}>
          <h3 style={{ textAlign: "center", marginBottom: 10 }}>Upcoming Scheduled Rides</h3>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            {rides.filter(r=>r.status==="scheduled").map(r => (
              <div
                key={r.id}
                style={{
                  padding: 16,
                  border: "1px solid #1976d2",
                  borderRadius: 7,
                  minWidth: 300,
                  background: "#f8fbff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8
                }}
              >
                <div style={{ flex: 1, textAlign: "left" }}>
                  <div>
                    <b>Pickup:</b>{" "}
                    {DateTime.fromISO(r.scheduledAt).toFormat("yyyy-MM-dd HH:mm")}
                  </div>
                  <div>
                    <b>Vehicle:</b> {r.vehicleType}
                  </div>
                  <div>
                    <b>Destination:</b> {r.destinationName}
                  </div>
                  {r.note && (
                    <div>
                      <b>Note:</b> {r.note}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <button
                    style={{
                      background: "#1976D2",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "0.4em 1em",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                    onClick={() => openScheduleModal(true, r)}
                  >
                    Edit
                  </button>
                  <button
                    style={{
                      background: "#f44336",
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      padding: "0.4em 1em",
                      fontWeight: "bold",
                      cursor: "pointer"
                    }}
                    onClick={() => handleCancelScheduledRide(r)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Active rides: pending/accepted/in_progress */}
      {rides.filter(r=>["pending","accepted","in_progress"].includes(r.status)).length > 0 && (
        <div style={{ margin: "30px 0" }}>
          <h3 style={{ textAlign: "center", marginBottom: 10 }}>Your Active Rides</h3>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
            {rides.filter(r=>["pending","accepted","in_progress"].includes(r.status)).map(r => (
              <div key={r.id} style={{
                padding: 18,
                border: "1px solid #388e3c",
                borderRadius: 7,
                minWidth: 320,
                background: "#e8f5e9",
                marginBottom: 16
              }}>
                <div style={{ marginBottom: 8 }}>
                  <b>Status:</b> {r.status}
                </div>
                <div>
                  <b>Pickup:</b> {DateTime.fromISO(r.scheduledAt).toFormat("yyyy-MM-dd HH:mm")}
                </div>
                <div>
                  <b>Vehicle:</b> {r.vehicleType}
                </div>
                <div>
                  <b>Destination:</b> {r.destinationName}
                </div>
                {r.driver && (
                  <div>
                    <b>Driver:</b> {r.driver.name || "Assigned"} ({r.driver.vehicleType || "Unknown"})
                  </div>
                )}
                <div style={{ marginTop: 10 }}>
                  <button
                    disabled={waiting}
                    style={{
                      background: "#f44336",
                      color: "#fff",
                      border: "none",
                      padding: "0.6em 1.2em",
                      borderRadius: 6,
                      fontSize: 15,
                      opacity: waiting ? 0.5 : 1
                    }}
                    onClick={() => handleCancelScheduledRide(r)}
                  >
                    Cancel Ride
                  </button>
                  {r.status === "in_progress" && (
                    <button
                      style={{
                        background: "#388e3c",
                        color: "#fff",
                        border: "none",
                        padding: "0.6em 1.2em",
                        borderRadius: 6,
                        fontSize: 15,
                        marginLeft: 12,
                        fontWeight: "bold"
                      }}
                      onClick={() => handleMarkRideDone(r)}
                    >
                      Ride is Done
                    </button>
                  )}
                </div>
                {["accepted","in_progress"].includes(r.status) && (
                  <div style={{
                    margin: "18px 0 0 0",
                    display: "flex",
                    justifyContent: "center",
                    height: "220px",
                    maxWidth: "400px"
                  }}>
                    <RestChatWindow
                      rideId={String(r.id)}
                      sender={{ id: getCustomerIdFromStorage(), name: "Customer", role: "customer", avatar: "" }}
                      messages={chatMessages[r.id] || []}
                      onSend={text => {
                        fetch(`${API_URL}/api/rides/${r.id}/chat/messages`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sender: {
                              id: getCustomerIdFromStorage(),
                              name: "Customer",
                              role: "customer",
                              avatar: "",
                            },
                            content: text,
                          }),
                        });
                      }}
                      style={{ height: "100%" }}
                    />
                  </div>
                )}
                {r.status === "done" && !r.rated && !ratingState[r.id] && (
                  <RateDriver rideId={r.id} onRated={() => setRatingState(prev => ({...prev, [r.id]: true}))} />
                )}
                {ratingState[r.id] && (
                  <div style={{ color: "#388e3c", marginTop: 16, fontWeight: "bold" }}>Thank you for rating!</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* SCHEDULE MODAL */}
      {modalState.open && (
        <div style={{
          position: "fixed",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.3)",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 24,
              minWidth: 350,
              boxShadow: "0 3px 18px #0002"
            }}
          >
            <h3 style={{ marginBottom: 16 }}>{modalState.edit ? "Edit Scheduled Ride" : "Schedule a Ride"}</h3>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>Pickup Date & Time:</div>
            <input
              type="datetime-local"
              value={formDatetime}
              onChange={e => setFormDatetime(e.target.value)}
              style={{ width: "100%", marginBottom: 14, padding: 6, borderRadius: 5, border: "1px solid #ccc" }}
            />
            <div style={{ marginBottom: 10, color: "#1976D2", fontWeight: "bold" }}>
              Detected pickup time zone: {pickupTimeZone || "Loading..."}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>Vehicle Type:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              {vehicleOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFormVehicleType(opt.value)}
                  type="button"
                  style={{
                    border: formVehicleType === opt.value ? "2px solid #1976D2" : "2px solid #ccc",
                    background: formVehicleType === opt.value ? "#e6f0ff" : "#fff",
                    borderRadius: 8,
                    padding: "12px 16px",
                    minWidth: 80,
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow: formVehicleType === opt.value ? "0 0 8px #1976D2" : "0 1px 3px #eee",
                    fontWeight: formVehicleType === opt.value ? "bold" : "normal",
                    fontSize: "1.05em"
                  }}
                >
                  <img src={opt.icon} alt={opt.label} style={{ width: 28, height: 28, marginBottom: 2 }} />
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>Destination:</div>
            <input
              type="text"
              value={formDestinationName}
              onChange={e => setFormDestinationName(e.target.value)}
              placeholder="Type destination (e.g. Airport, Hospital)"
              style={{ width: "100%", marginBottom: 10, padding: 6, borderRadius: 5, border: "1px solid #ccc" }}
            />
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>Note for Driver:</div>
            <input
              type="text"
              value={formNote}
              onChange={e => setFormNote(e.target.value)}
              placeholder="Optional note for driver"
              style={{ width: "100%", marginBottom: 14, padding: 6, borderRadius: 5, border: "1px solid #ccc" }}
            />
            <div style={{ textAlign: "center" }}>
              <button
                disabled={formWaiting}
                style={{
                  background: "#388e3c",
                  color: "#fff",
                  border: "none",
                  padding: "0.8em 2em",
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: "bold",
                  margin: "0 8px"
                }}
                onClick={handleConfirmScheduledRide}
              >
                {modalState.edit ? "Save Changes" : "Confirm Scheduled Ride"}
              </button>
              <button
                style={{
                  background: "#d32f2f",
                  color: "#fff",
                  border: "none",
                  padding: "0.8em 2em",
                  borderRadius: 6,
                  fontSize: 16,
                  fontWeight: "bold",
                  margin: "0 8px"
                }}
                onClick={closeScheduleModal}
              >
                Cancel
              </button>
            </div>
            {formError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>{formError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
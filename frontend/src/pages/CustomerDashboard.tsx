import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerCustomer from "../assets/marker-customer.png";
import carIcon from "../assets/marker-car.png";
import deliveryIcon from "../assets/marker-delivery.png";
import tuktukIcon from "../assets/marker-toktok.png";
import limoIcon from "../assets/marker-limo.png";
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
  { value: "LIMO", label: "Limo", icon: limoIcon },
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
type RideListItem = {
  id: number;
  vehicleType: string;
  status: RideStatus;
  destinationName?: string;
  scheduledAt?: string;
  note?: string;
  driver?: DriverInfo;
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

function saveChatSession(rideId: number | null, rideStatus: RideStatus) {
  localStorage.setItem("currentRideId", rideId ? String(rideId) : "");
  localStorage.setItem("currentRideStatus", rideStatus || "");
}

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

export default function CustomerDashboard() {
  // --- STATE ---
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
  const [showRating, setShowRating] = useState(false);
  const [showDoneButton, setShowDoneButton] = useState(false);

  // Scheduled ride modal state
  const [scheduledModalOpen, setScheduledModalOpen] = useState(false);
  const [schedEditMode, setSchedEditMode] = useState(false);
  const [schedRideId, setSchedRideId] = useState<number | null>(null);
  const [schedVehicleType, setSchedVehicleType] = useState<string>("");
  const [schedDestinationName, setSchedDestinationName] = useState<string>("");
  const [schedDatetime, setSchedDatetime] = useState<string>("");
  const [schedNote, setSchedNote] = useState<string>("");
  const [schedError, setSchedError] = useState<string | null>(null);
  const [schedWaiting, setSchedWaiting] = useState(false);

  // Timezone detection for pickup location
  const [pickupTimeZone, setPickupTimeZone] = useState<string>("UTC");
  const [localTime, setLocalTime] = useState<string>("");

  // Ride list state
  const [rideList, setRideList] = useState<RideListItem[]>([]);
  const [rideListLoading, setRideListLoading] = useState(false);

  // Helper: fetch timezone from coordinates using TimeZoneDB
  async function getTimeZoneFromCoords(lat: number, lng: number): Promise<string> {
    const apiKey = import.meta.env.VITE_TIMEZONEDB_API_KEY;
    if (!apiKey) {
      console.error("Missing VITE_TIMEZONEDB_API_KEY env variable!");
      return "UTC";
    }
    try {
      const res = await fetch(
        `https://api.timezonedb.com/v2.1/get-time-zone?key=${apiKey}&format=json&by=position&lat=${lat}&lng=${lng}`
      );
      const data = await res.json() as { zoneName?: string; message?: string; status?: string };
      if (data.zoneName) {
        return data.zoneName;
      } else if (data.status !== "OK" && data.message) {
        console.error("TimeZoneDB error:", data.message);
      }
    } catch (err) {
      console.error("Timezone fetch error:", err);
    }
    return "UTC";
  }

  // --- EFFECTS ---
  useEffect(() => {
    const onStorage = () => setToken(localStorage.getItem("token"));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Get the list of active/scheduled rides for this customer
  useEffect(() => {
    async function fetchRides() {
      const customerId = getCustomerIdFromStorage();
      if (!customerId) return;
      setRideListLoading(true);
      try {
        const res = await fetch(`${API_URL}/api/rides/all?customerId=${customerId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const rides: RideListItem[] = await res.json();
          // Filter out cancelled and done rides
          const filtered = rides.filter(
            r => r.status !== "cancelled" && r.status !== "done"
          );
          setRideList(filtered);
        }
      } catch (err) {
        setRideList([]);
      } finally {
        setRideListLoading(false);
      }
    }
    fetchRides();
  }, [token, showDoneActions, schedWaiting, schedEditMode, scheduledModalOpen, rideStatus]);

  // ... rest of your effects and handlers remain unchanged ...

  // --- Main UI ---
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
        Xzity Ride Request
      </h2>
      <div style={{ textAlign: "center", fontWeight: "bold", color: "#1976D2", fontSize: 17, marginBottom: 8 }}>
        Your current local time at pickup location: {localTime} {pickupTimeZone !== "UTC" ? `(${pickupTimeZone})` : ""}
      </div>
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
      <div style={{ margin: "24px 0", textAlign: "center", display: "flex", justifyContent: "center", gap: 20 }}>
        <button
          disabled={waiting || !pickupLocation || !vehicleType || !!(rideId && ["pending", "accepted", "in_progress", "scheduled"].includes(rideStatus || ""))}
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
          onClick={openScheduleModal}
          disabled={waiting || !!(rideId && ["pending", "accepted", "in_progress", "scheduled"].includes(rideStatus || ""))}
        >
          Schedule Ride
        </button>
      </div>
      {pickupLocation && (
        <div style={{ textAlign: "center", color: "#888" }}>
          Pickup Location: {pickupLocation.lat.toFixed(4)}, {pickupLocation.lng.toFixed(4)}
        </div>
      )}
      
      {/* --- Ride List Below --- */}
      <div style={{ margin: "32px 0 8px", textAlign: "center" }}>
        <h3 style={{ marginBottom: 8 }}>Your Rides</h3>
        {rideListLoading ? (
          <div>Loading...</div>
        ) : rideList.length === 0 ? (
          <div style={{ color: "#888" }}>No scheduled or active rides.</div>
        ) : (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {rideList
              .sort((a, b) => {
                // Sort by scheduledAt (if present), then by id (recent first)
                if (a.scheduledAt && b.scheduledAt)
                  return DateTime.fromISO(a.scheduledAt).toMillis() - DateTime.fromISO(b.scheduledAt).toMillis();
                if (a.scheduledAt) return -1;
                if (b.scheduledAt) return 1;
                return b.id - a.id;
              })
              .map(ride => (
                <div
                  key={ride.id}
                  style={{
                    background: "#f8f8ff",
                    border: "1px solid #eee",
                    borderRadius: 10,
                    margin: "16px auto",
                    padding: 14,
                    boxShadow: "0 2px 10px #eee",
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 18,
                  }}
                >
                  <div style={{ flex: 1, textAlign: "left" }}>
                    <div style={{ fontWeight: "bold", fontSize: 17 }}>
                      {ride.status === "scheduled"
                        ? "Scheduled"
                        : ride.status === "pending"
                        ? "Requested"
                        : ride.status === "accepted"
                        ? "Accepted"
                        : ride.status === "in_progress"
                        ? "In Progress"
                        : ""}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      <span>
                        <img
                          src={
                            vehicleOptions.find(opt => opt.value === ride.vehicleType)?.icon || carIcon
                          }
                          alt={ride.vehicleType}
                          style={{ width: 22, height: 22, marginBottom: -4, marginRight: 2 }}
                        />
                        {ride.vehicleType}
                      </span>
                      {ride.destinationName && (
                        <> | <span>{ride.destinationName}</span></>
                      )}
                    </div>
                    {ride.scheduledAt && (
                      <div style={{ color: "#555", fontSize: 14 }}>
                        Pickup: {DateTime.fromISO(ride.scheduledAt).toFormat("yyyy-MM-dd HH:mm")}
                      </div>
                    )}
                    {ride.note && (
                      <div style={{ color: "#888", fontSize: 13 }}>
                        Note: {ride.note}
                      </div>
                    )}
                    {ride.driver && (
                      <div style={{ color: "#1976D2", fontSize: 14 }}>
                        Driver: {ride.driver.name || "Assigned"} | Vehicle: {ride.driver.vehicleType || "Unknown"}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {(ride.status === "scheduled" || ride.status === "pending") && (
                      <>
                        <button
                          style={{
                            background: "#f44336",
                            color: "#fff",
                            border: "none",
                            padding: "0.5em 1.2em",
                            borderRadius: 6,
                            fontSize: 15,
                            marginBottom: 2,
                            fontWeight: "bold"
                          }}
                          onClick={() => {
                            setRideId(ride.id);
                            setRideStatus(ride.status);
                            handleCancelRide();
                          }}
                        >
                          Cancel
                        </button>
                        {ride.status === "scheduled" && (
                          <button
                            style={{
                              background: "#1976D2",
                              color: "#fff",
                              border: "none",
                              padding: "0.5em 1.2em",
                              borderRadius: 6,
                              fontSize: 15,
                              marginBottom: 2,
                              fontWeight: "bold"
                            }}
                            onClick={() => {
                              setSchedEditMode(true);
                              setSchedRideId(ride.id);
                              setSchedVehicleType(ride.vehicleType || "");
                              setSchedDestinationName(ride.destinationName || "");
                              setSchedDatetime(ride.scheduledAt ? DateTime.fromISO(ride.scheduledAt).toFormat("yyyy-MM-dd'T'HH:mm") : "");
                              setSchedNote(ride.note || "");
                              setScheduledModalOpen(true);
                            }}
                          >
                            Edit
                          </button>
                        )}
                      </>
                    )}
                    {ride.status === "in_progress" && (
                      <button
                        style={{
                          background: "#388e3c",
                          color: "#fff",
                          border: "none",
                          padding: "0.5em 1.2em",
                          borderRadius: 6,
                          fontSize: 15,
                          fontWeight: "bold"
                        }}
                        onClick={() => {
                          setRideId(ride.id);
                          setRideStatus(ride.status);
                          handleMarkRideDone();
                        }}
                      >
                        Done
                      </button>
                    )}
                    {(ride.status === "accepted" || ride.status === "in_progress") && (
                      <RestChatWindow
                        rideId={String(ride.id)}
                        sender={{ id: getCustomerIdFromStorage(), name: "Customer", role: "customer", avatar: "" }}
                        messages={chatMessages}
                        onSend={handleSendMessage}
                        style={{ width: 180, minHeight: 60, maxHeight: 220 }}
                      />
                    )}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* SCHEDULE MODAL */}
      {scheduledModalOpen && (
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
            <h3 style={{ marginBottom: 16 }}>{schedEditMode ? "Edit Scheduled Ride" : "Schedule a Ride"}</h3>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>Pickup Date & Time:</div>
            <input
              type="datetime-local"
              value={schedDatetime}
              onChange={e => setSchedDatetime(e.target.value)}
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
                  onClick={() => setSchedVehicleType(opt.value)}
                  type="button"
                  style={{
                    border: schedVehicleType === opt.value ? "2px solid #1976D2" : "2px solid #ccc",
                    background: schedVehicleType === opt.value ? "#e6f0ff" : "#fff",
                    borderRadius: 8,
                    padding: "12px 16px",
                    minWidth: 80,
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow: schedVehicleType === opt.value ? "0 0 8px #1976D2" : "0 1px 3px #eee",
                    fontWeight: schedVehicleType === opt.value ? "bold" : "normal",
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
              value={schedDestinationName}
              onChange={e => setSchedDestinationName(e.target.value)}
              placeholder="Type destination (e.g. Airport, Hospital)"
              style={{ width: "100%", marginBottom: 10, padding: 6, borderRadius: 5, border: "1px solid #ccc" }}
            />
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>Note for Driver:</div>
            <input
              type="text"
              value={schedNote}
              onChange={e => setSchedNote(e.target.value)}
              placeholder="Optional note for driver"
              style={{ width: "100%", marginBottom: 14, padding: 6, borderRadius: 5, border: "1px solid #ccc" }}
            />
            <div style={{ textAlign: "center" }}>
              <button
                disabled={schedWaiting}
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
                {schedEditMode ? "Save Changes" : "Confirm Scheduled Ride"}
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
            {schedError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>{schedError}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useEffect, useState, useCallback, useRef } from "react";
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

// ... rest of your constants and helper functions (vehicleOptions, createLeafletIcon, etc.) ...

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

// ... type definitions (RideStatus, EmergencyLocation, OverpassElement, DriverInfo, RideListItem) ...

type RideStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled"
  | "scheduled"
  | null;
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
type DriverInfo = {
  name?: string;
  vehicleType?: string;
  lastKnownLat?: number;
  lastKnownLng?: number;
  acceptedAt?: string;
};
type RideListItem = {
  id: number;
  vehicleType: string;
  status: RideStatus;
  destinationName?: string;
  scheduledAt?: string;
  note?: string;
  driver?: DriverInfo;
  acceptedAt?: string;
};

function RateDriver({
  rideId,
  onRated,
}: {
  rideId: number;
  onRated: () => void;
}) {
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
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ rating, feedback }),
    });
    setSubmitting(false);
    onRated();
  }
  return (
    <form onSubmit={handleSubmit} style={{ textAlign: "center", marginTop: 30 }}>
      <h3>Rate your driver</h3>
      <div style={{ marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => setRating(star)}
            style={{
              color: rating >= star ? "#FFD700" : "#CCC",
              fontSize: 28,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
            aria-label={`${star} star`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback"
        rows={3}
        style={{ display: "block", margin: "12px auto", width: "70%" }}
      />
      <button
        type="submit"
        disabled={submitting}
        style={{ padding: "0.5em 2em", marginTop: 8 }}
      >
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

// ------------- START OF MAIN COMPONENT --------------------
export default function CustomerDashboard() {
  // ... all your useState/useRef/useEffect code from your version above ...

  // All your code from your version above goes here (hook state, effects, handlers...)

  // --- UI Rendering Section ---
  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        Xzity Ride Request
      </h2>
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          color: "#1976D2",
          fontSize: 17,
          marginBottom: 8,
        }}
      >
        Your current local time at pickup location: {localTime}{" "}
        {pickupTimeZone !== "UTC" ? `(${pickupTimeZone})` : ""}
      </div>
      {error && (
        <div style={{ color: "#d32f2f", textAlign: "center" }}>{error}</div>
      )}
      {userLocation && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{
            height: 320,
            borderRadius: 8,
            margin: "0 auto",
            width: "100%",
            maxWidth: 640,
          }}
          whenCreated={(map) => {
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
          {/* --- DRIVER CAR MARKER --- */}
          {driverMarker && (
            <Marker
              position={[driverMarker.lat, driverMarker.lng]}
              icon={createLeafletIcon(carIcon, 40, 40)}
            >
              <Popup>Your Driver</Popup>
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
                      <a
                        href={`tel:${em.phone}`}
                        style={{
                          color: "#1976D2",
                          textDecoration: "none",
                        }}
                      >
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

      {/* --- Vehicle Type Selection --- */}
      <div style={{ margin: "24px 0", textAlign: "center" }}>
        <label>
          <b>Vehicle Type:</b>
        </label>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 10,
          }}
        >
          {vehicleOptions.map((opt) => (
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
                fontSize: "1.05em",
              }}
            >
              <img
                src={opt.icon}
                alt={opt.label}
                style={{ width: 32, height: 32, marginBottom: 3 }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- Request/Schedule Buttons --- */}
      <div
        style={{
          margin: "24px 0",
          textAlign: "center",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
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
            opacity: waiting ? 0.7 : 1,
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
            fontWeight: "bold",
          }}
          onClick={openScheduleModal}
          disabled={waiting}
        >
          Schedule Ride
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        {activeRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {activeRideLimitError}
          </div>
        )}
        {scheduledRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {scheduledRideLimitError}
          </div>
        )}
      </div>

      {/* --- Ride List Below --- */}
      <div style={{ margin: "32px 0 8px", textAlign: "center" }}>
        <h3 style={{ marginBottom: 8 }}>See Your Rides below, to cancel or edit rides.</h3>
        {rideListLoading ? (
          <div>Loading...</div>
        ) : rideList.length === 0 ? (
          <div style={{ color: "#888" }}>
            No scheduled or active rides.
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {rideList
              .sort((a, b) => {
                if (a.scheduledAt && b.scheduledAt)
                  return (
                    DateTime.fromISO(a.scheduledAt).toMillis() -
                    DateTime.fromISO(b.scheduledAt).toMillis()
                  );
                if (a.scheduledAt) return -1;
                if (b.scheduledAt) return 1;
                return b.id - a.id;
              })
              .map((ride) => {
                const normalizedStatus = (ride.status || "")
                  .toLowerCase()
                  .trim();
                return (
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
                        {normalizedStatus === "scheduled"
                          ? "Scheduled"
                          : normalizedStatus === "pending"
                          ? "Requested"
                          : normalizedStatus === "accepted"
                          ? "Accepted"
                          : normalizedStatus === "in_progress"
                          ? "In Progress"
                          : ""}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <span>
                          <img
                            src={
                              vehicleOptions.find(
                                (opt) =>
                                  opt.value === ride.vehicleType
                              )?.icon || carIcon
                            }
                            alt={ride.vehicleType}
                            style={{
                              width: 22,
                              height: 22,
                              marginBottom: -4,
                              marginRight: 2,
                            }}
                          />
                          {ride.vehicleType}
                        </span>
                        {ride.destinationName && (
                          <>
                            {" "}
                            | <span>{ride.destinationName}</span>
                          </>
                        )}
                      </div>
                      {ride.scheduledAt && (
                        <div style={{ color: "#555", fontSize: 14 }}>
                          Pickup:{" "}
                          {DateTime.fromISO(ride.scheduledAt).toFormat(
                            "yyyy-MM-dd HH:mm"
                          )}
                        </div>
                      )}
                      {ride.note && (
                        <div style={{ color: "#888", fontSize: 13 }}>
                          Note: {ride.note}
                        </div>
                      )}
                      {ride.driver && (
                        <div style={{ color: "#1976D2", fontSize: 14 }}>
                          Driver: {ride.driver.name || "Assigned"} | Vehicle:{" "}
                          {ride.driver.vehicleType || "Unknown"}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {ratingRideId === ride.id ? (
                        <RateDriver
                          rideId={ride.id}
                          onRated={() => {
                            setRatingRideId(null);
                            setRideList((prev) =>
                              prev.filter((r) => r.id !== ride.id)
                            );
                          }}
                        />
                      ) : (
                        <>
                          {["pending", "scheduled"].includes(
                            normalizedStatus
                          ) && (
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
                                  fontWeight: "bold",
                                }}
                                onClick={() => handleCancelRide(ride.id)}
                              >
                                Cancel
                              </button>
                              {normalizedStatus === "scheduled" && (
                                <button
                                  style={{
                                    background: "#1976D2",
                                    color: "#fff",
                                    border: "none",
                                    padding: "0.5em 1.2em",
                                    borderRadius: 6,
                                    fontSize: 15,
                                    marginBottom: 2,
                                    fontWeight: "bold",
                                  }}
                                  onClick={() => {
                                    setSchedEditMode(true);
                                    setSchedRideId(ride.id);
                                    setSchedVehicleType(
                                      ride.vehicleType || ""
                                    );
                                    setSchedDestinationName(
                                      ride.destinationName || ""
                                    );
                                    setSchedDatetime(
                                      ride.scheduledAt
                                        ? DateTime.fromISO(
                                            ride.scheduledAt
                                          ).toFormat(
                                            "yyyy-MM-dd'T'HH:mm"
                                          )
                                        : ""
                                    );
                                    setSchedNote(ride.note || "");
                                    setScheduledModalOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                            </>
                          )}
                          {normalizedStatus === "in_progress" && (
                            <button
                              style={{
                                background: "#388e3c",
                                color: "#fff",
                                border: "none",
                                padding: "0.5em 1.2em",
                                borderRadius: 6,
                                fontSize: 15,
                                fontWeight: "bold",
                              }}
                              onClick={() => handleMarkRideDone(ride.id)}
                            >
                              Done
                            </button>
                          )}
                          {(normalizedStatus === "accepted" ||
                            normalizedStatus === "in_progress") && (
                            <RestChatWindow
                              rideId={String(ride.id)}
                              sender={{
                                id: getCustomerIdFromStorage(),
                                name: "Customer",
                                role: "customer",
                                avatar: "",
                              }}
                              messages={
                                chatMessagesByRideId[String(ride.id)] || []
                              }
                              onSend={(text) =>
                                handleSendMessage(text, ride.id)
                              }
                              style={{
                                width: 180,
                                minHeight: 60,
                                maxHeight: 220,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* --- Scheduled Modal --- */}
      {scheduledModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 24,
              minWidth: 350,
              boxShadow: "0 3px 18px #0002",
            }}
          >
            <h3 style={{ marginBottom: 16 }}>
              {schedEditMode ? "Edit Scheduled Ride" : "Schedule a Ride"}
            </h3>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Pickup Date & Time:
            </div>
            <input
              type="datetime-local"
              value={schedDatetime}
              onChange={(e) => setSchedDatetime(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div
              style={{
                marginBottom: 10,
                color: "#1976D2",
                fontWeight: "bold",
              }}
            >
              Detected pickup time zone:{" "}
              {pickupTimeZone || "Loading..."}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Vehicle Type:
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 14,
              }}
            >
              {vehicleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSchedVehicleType(opt.value)}
                  type="button"
                  style={{
                    border:
                      schedVehicleType === opt.value
                        ? "2px solid #1976D2"
                        : "2px solid #ccc",
                    background:
                      schedVehicleType === opt.value ? "#e6f0ff" : "#fff",
                    borderRadius: 8,
                    padding: "12px 16px",
                    minWidth: 80,
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow:
                      schedVehicleType === opt.value
                        ? "0 0 8px #1976D2"
                        : "0 1px 3px #eee",
                    fontWeight:
                      schedVehicleType === opt.value ? "bold" : "normal",
                    fontSize: "1.05em",
                  }}
                >
                  <img
                    src={opt.icon}
                    alt={opt.label}
                    style={{
                      width: 28,
                      height: 28,
                      marginBottom: 2,
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Destination:
            </div>
            <input
              type="text"
              value={schedDestinationName}
              onChange={(e) => setSchedDestinationName(e.target.value)}
              placeholder="Type destination (e.g. Airport, Hospital)"
              style={{
                width: "100%",
                marginBottom: 10,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Note for Driver:
            </div>
            <input
              type="text"
              value={schedNote}
              onChange={(e) => setSchedNote(e.target.value)}
              placeholder="Optional note for driver"
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
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
                  margin: "0 8px",
                }}
                onClick={handleConfirmScheduledRide}
              >
                {schedEditMode
                  ? "Save Changes"
                  : "Confirm Scheduled Ride"}
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
                  margin: "0 8px",
                }}
                onClick={closeScheduleModal}
              >
                Cancel
              </button>
            </div>
            {schedError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {schedError}
              </div>
            )}
            {scheduledRideLimitError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {scheduledRideLimitError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}import React, { useEffect, useState, useCallback, useRef } from "react";
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

// ... rest of your constants and helper functions (vehicleOptions, createLeafletIcon, etc.) ...

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

// ... type definitions (RideStatus, EmergencyLocation, OverpassElement, DriverInfo, RideListItem) ...

type RideStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled"
  | "scheduled"
  | null;
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
type DriverInfo = {
  name?: string;
  vehicleType?: string;
  lastKnownLat?: number;
  lastKnownLng?: number;
  acceptedAt?: string;
};
type RideListItem = {
  id: number;
  vehicleType: string;
  status: RideStatus;
  destinationName?: string;
  scheduledAt?: string;
  note?: string;
  driver?: DriverInfo;
  acceptedAt?: string;
};

function RateDriver({
  rideId,
  onRated,
}: {
  rideId: number;
  onRated: () => void;
}) {
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
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ rating, feedback }),
    });
    setSubmitting(false);
    onRated();
  }
  return (
    <form onSubmit={handleSubmit} style={{ textAlign: "center", marginTop: 30 }}>
      <h3>Rate your driver</h3>
      <div style={{ marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => setRating(star)}
            style={{
              color: rating >= star ? "#FFD700" : "#CCC",
              fontSize: 28,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
            aria-label={`${star} star`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback"
        rows={3}
        style={{ display: "block", margin: "12px auto", width: "70%" }}
      />
      <button
        type="submit"
        disabled={submitting}
        style={{ padding: "0.5em 2em", marginTop: 8 }}
      >
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

// ------------- START OF MAIN COMPONENT --------------------
export default function CustomerDashboard() {
  // ... all your useState/useRef/useEffect code from your version above ...

  // All your code from your version above goes here (hook state, effects, handlers...)

  // --- UI Rendering Section ---
  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        Xzity Ride Request
      </h2>
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          color: "#1976D2",
          fontSize: 17,
          marginBottom: 8,
        }}
      >
        Your current local time at pickup location: {localTime}{" "}
        {pickupTimeZone !== "UTC" ? `(${pickupTimeZone})` : ""}
      </div>
      {error && (
        <div style={{ color: "#d32f2f", textAlign: "center" }}>{error}</div>
      )}
      {userLocation && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{
            height: 320,
            borderRadius: 8,
            margin: "0 auto",
            width: "100%",
            maxWidth: 640,
          }}
          whenCreated={(map) => {
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
          {/* --- DRIVER CAR MARKER --- */}
          {driverMarker && (
            <Marker
              position={[driverMarker.lat, driverMarker.lng]}
              icon={createLeafletIcon(carIcon, 40, 40)}
            >
              <Popup>Your Driver</Popup>
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
                      <a
                        href={`tel:${em.phone}`}
                        style={{
                          color: "#1976D2",
                          textDecoration: "none",
                        }}
                      >
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

      {/* --- Vehicle Type Selection --- */}
      <div style={{ margin: "24px 0", textAlign: "center" }}>
        <label>
          <b>Vehicle Type:</b>
        </label>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 10,
          }}
        >
          {vehicleOptions.map((opt) => (
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
                fontSize: "1.05em",
              }}
            >
              <img
                src={opt.icon}
                alt={opt.label}
                style={{ width: 32, height: 32, marginBottom: 3 }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- Request/Schedule Buttons --- */}
      <div
        style={{
          margin: "24px 0",
          textAlign: "center",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
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
            opacity: waiting ? 0.7 : 1,
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
            fontWeight: "bold",
          }}
          onClick={openScheduleModal}
          disabled={waiting}
        >
          Schedule Ride
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        {activeRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {activeRideLimitError}
          </div>
        )}
        {scheduledRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {scheduledRideLimitError}
          </div>
        )}
      </div>

      {/* --- Ride List Below --- */}
      <div style={{ margin: "32px 0 8px", textAlign: "center" }}>
        <h3 style={{ marginBottom: 8 }}>See Your Rides below, to cancel or edit rides.</h3>
        {rideListLoading ? (
          <div>Loading...</div>
        ) : rideList.length === 0 ? (
          <div style={{ color: "#888" }}>
            No scheduled or active rides.
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {rideList
              .sort((a, b) => {
                if (a.scheduledAt && b.scheduledAt)
                  return (
                    DateTime.fromISO(a.scheduledAt).toMillis() -
                    DateTime.fromISO(b.scheduledAt).toMillis()
                  );
                if (a.scheduledAt) return -1;
                if (b.scheduledAt) return 1;
                return b.id - a.id;
              })
              .map((ride) => {
                const normalizedStatus = (ride.status || "")
                  .toLowerCase()
                  .trim();
                return (
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
                        {normalizedStatus === "scheduled"
                          ? "Scheduled"
                          : normalizedStatus === "pending"
                          ? "Requested"
                          : normalizedStatus === "accepted"
                          ? "Accepted"
                          : normalizedStatus === "in_progress"
                          ? "In Progress"
                          : ""}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <span>
                          <img
                            src={
                              vehicleOptions.find(
                                (opt) =>
                                  opt.value === ride.vehicleType
                              )?.icon || carIcon
                            }
                            alt={ride.vehicleType}
                            style={{
                              width: 22,
                              height: 22,
                              marginBottom: -4,
                              marginRight: 2,
                            }}
                          />
                          {ride.vehicleType}
                        </span>
                        {ride.destinationName && (
                          <>
                            {" "}
                            | <span>{ride.destinationName}</span>
                          </>
                        )}
                      </div>
                      {ride.scheduledAt && (
                        <div style={{ color: "#555", fontSize: 14 }}>
                          Pickup:{" "}
                          {DateTime.fromISO(ride.scheduledAt).toFormat(
                            "yyyy-MM-dd HH:mm"
                          )}
                        </div>
                      )}
                      {ride.note && (
                        <div style={{ color: "#888", fontSize: 13 }}>
                          Note: {ride.note}
                        </div>
                      )}
                      {ride.driver && (
                        <div style={{ color: "#1976D2", fontSize: 14 }}>
                          Driver: {ride.driver.name || "Assigned"} | Vehicle:{" "}
                          {ride.driver.vehicleType || "Unknown"}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {ratingRideId === ride.id ? (
                        <RateDriver
                          rideId={ride.id}
                          onRated={() => {
                            setRatingRideId(null);
                            setRideList((prev) =>
                              prev.filter((r) => r.id !== ride.id)
                            );
                          }}
                        />
                      ) : (
                        <>
                          {["pending", "scheduled"].includes(
                            normalizedStatus
                          ) && (
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
                                  fontWeight: "bold",
                                }}
                                onClick={() => handleCancelRide(ride.id)}
                              >
                                Cancel
                              </button>
                              {normalizedStatus === "scheduled" && (
                                <button
                                  style={{
                                    background: "#1976D2",
                                    color: "#fff",
                                    border: "none",
                                    padding: "0.5em 1.2em",
                                    borderRadius: 6,
                                    fontSize: 15,
                                    marginBottom: 2,
                                    fontWeight: "bold",
                                  }}
                                  onClick={() => {
                                    setSchedEditMode(true);
                                    setSchedRideId(ride.id);
                                    setSchedVehicleType(
                                      ride.vehicleType || ""
                                    );
                                    setSchedDestinationName(
                                      ride.destinationName || ""
                                    );
                                    setSchedDatetime(
                                      ride.scheduledAt
                                        ? DateTime.fromISO(
                                            ride.scheduledAt
                                          ).toFormat(
                                            "yyyy-MM-dd'T'HH:mm"
                                          )
                                        : ""
                                    );
                                    setSchedNote(ride.note || "");
                                    setScheduledModalOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                            </>
                          )}
                          {normalizedStatus === "in_progress" && (
                            <button
                              style={{
                                background: "#388e3c",
                                color: "#fff",
                                border: "none",
                                padding: "0.5em 1.2em",
                                borderRadius: 6,
                                fontSize: 15,
                                fontWeight: "bold",
                              }}
                              onClick={() => handleMarkRideDone(ride.id)}
                            >
                              Done
                            </button>
                          )}
                          {(normalizedStatus === "accepted" ||
                            normalizedStatus === "in_progress") && (
                            <RestChatWindow
                              rideId={String(ride.id)}
                              sender={{
                                id: getCustomerIdFromStorage(),
                                name: "Customer",
                                role: "customer",
                                avatar: "",
                              }}
                              messages={
                                chatMessagesByRideId[String(ride.id)] || []
                              }
                              onSend={(text) =>
                                handleSendMessage(text, ride.id)
                              }
                              style={{
                                width: 180,
                                minHeight: 60,
                                maxHeight: 220,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* --- Scheduled Modal --- */}
      {scheduledModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 24,
              minWidth: 350,
              boxShadow: "0 3px 18px #0002",
            }}
          >
            <h3 style={{ marginBottom: 16 }}>
              {schedEditMode ? "Edit Scheduled Ride" : "Schedule a Ride"}
            </h3>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Pickup Date & Time:
            </div>
            <input
              type="datetime-local"
              value={schedDatetime}
              onChange={(e) => setSchedDatetime(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div
              style={{
                marginBottom: 10,
                color: "#1976D2",
                fontWeight: "bold",
              }}
            >
              Detected pickup time zone:{" "}
              {pickupTimeZone || "Loading..."}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Vehicle Type:
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 14,
              }}
            >
              {vehicleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSchedVehicleType(opt.value)}
                  type="button"
                  style={{
                    border:
                      schedVehicleType === opt.value
                        ? "2px solid #1976D2"
                        : "2px solid #ccc",
                    background:
                      schedVehicleType === opt.value ? "#e6f0ff" : "#fff",
                    borderRadius: 8,
                    padding: "12px 16px",
                    minWidth: 80,
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow:
                      schedVehicleType === opt.value
                        ? "0 0 8px #1976D2"
                        : "0 1px 3px #eee",
                    fontWeight:
                      schedVehicleType === opt.value ? "bold" : "normal",
                    fontSize: "1.05em",
                  }}
                >
                  <img
                    src={opt.icon}
                    alt={opt.label}
                    style={{
                      width: 28,
                      height: 28,
                      marginBottom: 2,
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Destination:
            </div>
            <input
              type="text"
              value={schedDestinationName}
              onChange={(e) => setSchedDestinationName(e.target.value)}
              placeholder="Type destination (e.g. Airport, Hospital)"
              style={{
                width: "100%",
                marginBottom: 10,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Note for Driver:
            </div>
            <input
              type="text"
              value={schedNote}
              onChange={(e) => setSchedNote(e.target.value)}
              placeholder="Optional note for driver"
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
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
                  margin: "0 8px",
                }}
                onClick={handleConfirmScheduledRide}
              >
                {schedEditMode
                  ? "Save Changes"
                  : "Confirm Scheduled Ride"}
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
                  margin: "0 8px",
                }}
                onClick={closeScheduleModal}
              >
                Cancel
              </button>
            </div>
            {schedError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {schedError}
              </div>
            )}
            {scheduledRideLimitError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {scheduledRideLimitError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}import React, { useEffect, useState, useCallback, useRef } from "react";
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

// ... rest of your constants and helper functions (vehicleOptions, createLeafletIcon, etc.) ...

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

// ... type definitions (RideStatus, EmergencyLocation, OverpassElement, DriverInfo, RideListItem) ...

type RideStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled"
  | "scheduled"
  | null;
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
type DriverInfo = {
  name?: string;
  vehicleType?: string;
  lastKnownLat?: number;
  lastKnownLng?: number;
  acceptedAt?: string;
};
type RideListItem = {
  id: number;
  vehicleType: string;
  status: RideStatus;
  destinationName?: string;
  scheduledAt?: string;
  note?: string;
  driver?: DriverInfo;
  acceptedAt?: string;
};

function RateDriver({
  rideId,
  onRated,
}: {
  rideId: number;
  onRated: () => void;
}) {
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
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ rating, feedback }),
    });
    setSubmitting(false);
    onRated();
  }
  return (
    <form onSubmit={handleSubmit} style={{ textAlign: "center", marginTop: 30 }}>
      <h3>Rate your driver</h3>
      <div style={{ marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => setRating(star)}
            style={{
              color: rating >= star ? "#FFD700" : "#CCC",
              fontSize: 28,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
            aria-label={`${star} star`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback"
        rows={3}
        style={{ display: "block", margin: "12px auto", width: "70%" }}
      />
      <button
        type="submit"
        disabled={submitting}
        style={{ padding: "0.5em 2em", marginTop: 8 }}
      >
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

// ------------- START OF MAIN COMPONENT --------------------
export default function CustomerDashboard() {
  // ... all your useState/useRef/useEffect code from your version above ...

  // All your code from your version above goes here (hook state, effects, handlers...)

  // --- UI Rendering Section ---
  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        Xzity Ride Request
      </h2>
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          color: "#1976D2",
          fontSize: 17,
          marginBottom: 8,
        }}
      >
        Your current local time at pickup location: {localTime}{" "}
        {pickupTimeZone !== "UTC" ? `(${pickupTimeZone})` : ""}
      </div>
      {error && (
        <div style={{ color: "#d32f2f", textAlign: "center" }}>{error}</div>
      )}
      {userLocation && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{
            height: 320,
            borderRadius: 8,
            margin: "0 auto",
            width: "100%",
            maxWidth: 640,
          }}
          whenCreated={(map) => {
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
          {/* --- DRIVER CAR MARKER --- */}
          {driverMarker && (
            <Marker
              position={[driverMarker.lat, driverMarker.lng]}
              icon={createLeafletIcon(carIcon, 40, 40)}
            >
              <Popup>Your Driver</Popup>
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
                      <a
                        href={`tel:${em.phone}`}
                        style={{
                          color: "#1976D2",
                          textDecoration: "none",
                        }}
                      >
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

      {/* --- Vehicle Type Selection --- */}
      <div style={{ margin: "24px 0", textAlign: "center" }}>
        <label>
          <b>Vehicle Type:</b>
        </label>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 10,
          }}
        >
          {vehicleOptions.map((opt) => (
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
                fontSize: "1.05em",
              }}
            >
              <img
                src={opt.icon}
                alt={opt.label}
                style={{ width: 32, height: 32, marginBottom: 3 }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- Request/Schedule Buttons --- */}
      <div
        style={{
          margin: "24px 0",
          textAlign: "center",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
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
            opacity: waiting ? 0.7 : 1,
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
            fontWeight: "bold",
          }}
          onClick={openScheduleModal}
          disabled={waiting}
        >
          Schedule Ride
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        {activeRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {activeRideLimitError}
          </div>
        )}
        {scheduledRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {scheduledRideLimitError}
          </div>
        )}
      </div>

      {/* --- Ride List Below --- */}
      <div style={{ margin: "32px 0 8px", textAlign: "center" }}>
        <h3 style={{ marginBottom: 8 }}>See Your Rides below, to cancel or edit rides.</h3>
        {rideListLoading ? (
          <div>Loading...</div>
        ) : rideList.length === 0 ? (
          <div style={{ color: "#888" }}>
            No scheduled or active rides.
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {rideList
              .sort((a, b) => {
                if (a.scheduledAt && b.scheduledAt)
                  return (
                    DateTime.fromISO(a.scheduledAt).toMillis() -
                    DateTime.fromISO(b.scheduledAt).toMillis()
                  );
                if (a.scheduledAt) return -1;
                if (b.scheduledAt) return 1;
                return b.id - a.id;
              })
              .map((ride) => {
                const normalizedStatus = (ride.status || "")
                  .toLowerCase()
                  .trim();
                return (
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
                        {normalizedStatus === "scheduled"
                          ? "Scheduled"
                          : normalizedStatus === "pending"
                          ? "Requested"
                          : normalizedStatus === "accepted"
                          ? "Accepted"
                          : normalizedStatus === "in_progress"
                          ? "In Progress"
                          : ""}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <span>
                          <img
                            src={
                              vehicleOptions.find(
                                (opt) =>
                                  opt.value === ride.vehicleType
                              )?.icon || carIcon
                            }
                            alt={ride.vehicleType}
                            style={{
                              width: 22,
                              height: 22,
                              marginBottom: -4,
                              marginRight: 2,
                            }}
                          />
                          {ride.vehicleType}
                        </span>
                        {ride.destinationName && (
                          <>
                            {" "}
                            | <span>{ride.destinationName}</span>
                          </>
                        )}
                      </div>
                      {ride.scheduledAt && (
                        <div style={{ color: "#555", fontSize: 14 }}>
                          Pickup:{" "}
                          {DateTime.fromISO(ride.scheduledAt).toFormat(
                            "yyyy-MM-dd HH:mm"
                          )}
                        </div>
                      )}
                      {ride.note && (
                        <div style={{ color: "#888", fontSize: 13 }}>
                          Note: {ride.note}
                        </div>
                      )}
                      {ride.driver && (
                        <div style={{ color: "#1976D2", fontSize: 14 }}>
                          Driver: {ride.driver.name || "Assigned"} | Vehicle:{" "}
                          {ride.driver.vehicleType || "Unknown"}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {ratingRideId === ride.id ? (
                        <RateDriver
                          rideId={ride.id}
                          onRated={() => {
                            setRatingRideId(null);
                            setRideList((prev) =>
                              prev.filter((r) => r.id !== ride.id)
                            );
                          }}
                        />
                      ) : (
                        <>
                          {["pending", "scheduled"].includes(
                            normalizedStatus
                          ) && (
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
                                  fontWeight: "bold",
                                }}
                                onClick={() => handleCancelRide(ride.id)}
                              >
                                Cancel
                              </button>
                              {normalizedStatus === "scheduled" && (
                                <button
                                  style={{
                                    background: "#1976D2",
                                    color: "#fff",
                                    border: "none",
                                    padding: "0.5em 1.2em",
                                    borderRadius: 6,
                                    fontSize: 15,
                                    marginBottom: 2,
                                    fontWeight: "bold",
                                  }}
                                  onClick={() => {
                                    setSchedEditMode(true);
                                    setSchedRideId(ride.id);
                                    setSchedVehicleType(
                                      ride.vehicleType || ""
                                    );
                                    setSchedDestinationName(
                                      ride.destinationName || ""
                                    );
                                    setSchedDatetime(
                                      ride.scheduledAt
                                        ? DateTime.fromISO(
                                            ride.scheduledAt
                                          ).toFormat(
                                            "yyyy-MM-dd'T'HH:mm"
                                          )
                                        : ""
                                    );
                                    setSchedNote(ride.note || "");
                                    setScheduledModalOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                            </>
                          )}
                          {normalizedStatus === "in_progress" && (
                            <button
                              style={{
                                background: "#388e3c",
                                color: "#fff",
                                border: "none",
                                padding: "0.5em 1.2em",
                                borderRadius: 6,
                                fontSize: 15,
                                fontWeight: "bold",
                              }}
                              onClick={() => handleMarkRideDone(ride.id)}
                            >
                              Done
                            </button>
                          )}
                          {(normalizedStatus === "accepted" ||
                            normalizedStatus === "in_progress") && (
                            <RestChatWindow
                              rideId={String(ride.id)}
                              sender={{
                                id: getCustomerIdFromStorage(),
                                name: "Customer",
                                role: "customer",
                                avatar: "",
                              }}
                              messages={
                                chatMessagesByRideId[String(ride.id)] || []
                              }
                              onSend={(text) =>
                                handleSendMessage(text, ride.id)
                              }
                              style={{
                                width: 180,
                                minHeight: 60,
                                maxHeight: 220,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* --- Scheduled Modal --- */}
      {scheduledModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 24,
              minWidth: 350,
              boxShadow: "0 3px 18px #0002",
            }}
          >
            <h3 style={{ marginBottom: 16 }}>
              {schedEditMode ? "Edit Scheduled Ride" : "Schedule a Ride"}
            </h3>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Pickup Date & Time:
            </div>
            <input
              type="datetime-local"
              value={schedDatetime}
              onChange={(e) => setSchedDatetime(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div
              style={{
                marginBottom: 10,
                color: "#1976D2",
                fontWeight: "bold",
              }}
            >
              Detected pickup time zone:{" "}
              {pickupTimeZone || "Loading..."}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Vehicle Type:
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 14,
              }}
            >
              {vehicleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSchedVehicleType(opt.value)}
                  type="button"
                  style={{
                    border:
                      schedVehicleType === opt.value
                        ? "2px solid #1976D2"
                        : "2px solid #ccc",
                    background:
                      schedVehicleType === opt.value ? "#e6f0ff" : "#fff",
                    borderRadius: 8,
                    padding: "12px 16px",
                    minWidth: 80,
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow:
                      schedVehicleType === opt.value
                        ? "0 0 8px #1976D2"
                        : "0 1px 3px #eee",
                    fontWeight:
                      schedVehicleType === opt.value ? "bold" : "normal",
                    fontSize: "1.05em",
                  }}
                >
                  <img
                    src={opt.icon}
                    alt={opt.label}
                    style={{
                      width: 28,
                      height: 28,
                      marginBottom: 2,
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Destination:
            </div>
            <input
              type="text"
              value={schedDestinationName}
              onChange={(e) => setSchedDestinationName(e.target.value)}
              placeholder="Type destination (e.g. Airport, Hospital)"
              style={{
                width: "100%",
                marginBottom: 10,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Note for Driver:
            </div>
            <input
              type="text"
              value={schedNote}
              onChange={(e) => setSchedNote(e.target.value)}
              placeholder="Optional note for driver"
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
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
                  margin: "0 8px",
                }}
                onClick={handleConfirmScheduledRide}
              >
                {schedEditMode
                  ? "Save Changes"
                  : "Confirm Scheduled Ride"}
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
                  margin: "0 8px",
                }}
                onClick={closeScheduleModal}
              >
                Cancel
              </button>
            </div>
            {schedError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {schedError}
              </div>
            )}
            {scheduledRideLimitError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {scheduledRideLimitError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}import React, { useEffect, useState, useCallback, useRef } from "react";
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

// ... rest of your constants and helper functions (vehicleOptions, createLeafletIcon, etc.) ...

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

// ... type definitions (RideStatus, EmergencyLocation, OverpassElement, DriverInfo, RideListItem) ...

type RideStatus =
  | "pending"
  | "accepted"
  | "in_progress"
  | "done"
  | "cancelled"
  | "scheduled"
  | null;
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
type DriverInfo = {
  name?: string;
  vehicleType?: string;
  lastKnownLat?: number;
  lastKnownLng?: number;
  acceptedAt?: string;
};
type RideListItem = {
  id: number;
  vehicleType: string;
  status: RideStatus;
  destinationName?: string;
  scheduledAt?: string;
  note?: string;
  driver?: DriverInfo;
  acceptedAt?: string;
};

function RateDriver({
  rideId,
  onRated,
}: {
  rideId: number;
  onRated: () => void;
}) {
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
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ rating, feedback }),
    });
    setSubmitting(false);
    onRated();
  }
  return (
    <form onSubmit={handleSubmit} style={{ textAlign: "center", marginTop: 30 }}>
      <h3>Rate your driver</h3>
      <div style={{ marginBottom: 10 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            type="button"
            key={star}
            onClick={() => setRating(star)}
            style={{
              color: rating >= star ? "#FFD700" : "#CCC",
              fontSize: 28,
              border: "none",
              background: "none",
              cursor: "pointer",
            }}
            aria-label={`${star} star`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Optional feedback"
        rows={3}
        style={{ display: "block", margin: "12px auto", width: "70%" }}
      />
      <button
        type="submit"
        disabled={submitting}
        style={{ padding: "0.5em 2em", marginTop: 8 }}
      >
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

// ------------- START OF MAIN COMPONENT --------------------
export default function CustomerDashboard() {
  // ... all your useState/useRef/useEffect code from your version above ...

  // All your code from your version above goes here (hook state, effects, handlers...)

  // --- UI Rendering Section ---
  return (
    <div style={{ padding: 24 }}>
      <h2
        style={{
          textAlign: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        Xzity Ride Request
      </h2>
      <div
        style={{
          textAlign: "center",
          fontWeight: "bold",
          color: "#1976D2",
          fontSize: 17,
          marginBottom: 8,
        }}
      >
        Your current local time at pickup location: {localTime}{" "}
        {pickupTimeZone !== "UTC" ? `(${pickupTimeZone})` : ""}
      </div>
      {error && (
        <div style={{ color: "#d32f2f", textAlign: "center" }}>{error}</div>
      )}
      {userLocation && (
        <MapContainer
          center={[userLocation.lat, userLocation.lng]}
          zoom={13}
          style={{
            height: 320,
            borderRadius: 8,
            margin: "0 auto",
            width: "100%",
            maxWidth: 640,
          }}
          whenCreated={(map) => {
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
          {/* --- DRIVER CAR MARKER --- */}
          {driverMarker && (
            <Marker
              position={[driverMarker.lat, driverMarker.lng]}
              icon={createLeafletIcon(carIcon, 40, 40)}
            >
              <Popup>Your Driver</Popup>
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
                      <a
                        href={`tel:${em.phone}`}
                        style={{
                          color: "#1976D2",
                          textDecoration: "none",
                        }}
                      >
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

      {/* --- Vehicle Type Selection --- */}
      <div style={{ margin: "24px 0", textAlign: "center" }}>
        <label>
          <b>Vehicle Type:</b>
        </label>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: 16,
            marginTop: 10,
          }}
        >
          {vehicleOptions.map((opt) => (
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
                fontSize: "1.05em",
              }}
            >
              <img
                src={opt.icon}
                alt={opt.label}
                style={{ width: 32, height: 32, marginBottom: 3 }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- Request/Schedule Buttons --- */}
      <div
        style={{
          margin: "24px 0",
          textAlign: "center",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
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
            opacity: waiting ? 0.7 : 1,
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
            fontWeight: "bold",
          }}
          onClick={openScheduleModal}
          disabled={waiting}
        >
          Schedule Ride
        </button>
      </div>

      <div style={{ textAlign: "center" }}>
        {activeRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {activeRideLimitError}
          </div>
        )}
        {scheduledRideLimitError && (
          <div style={{ color: "#d32f2f", marginTop: 6 }}>
            {scheduledRideLimitError}
          </div>
        )}
      </div>

      {/* --- Ride List Below --- */}
      <div style={{ margin: "32px 0 8px", textAlign: "center" }}>
        <h3 style={{ marginBottom: 8 }}>See Your Rides below, to cancel or edit rides.</h3>
        {rideListLoading ? (
          <div>Loading...</div>
        ) : rideList.length === 0 ? (
          <div style={{ color: "#888" }}>
            No scheduled or active rides.
          </div>
        ) : (
          <div style={{ maxWidth: 700, margin: "0 auto" }}>
            {rideList
              .sort((a, b) => {
                if (a.scheduledAt && b.scheduledAt)
                  return (
                    DateTime.fromISO(a.scheduledAt).toMillis() -
                    DateTime.fromISO(b.scheduledAt).toMillis()
                  );
                if (a.scheduledAt) return -1;
                if (b.scheduledAt) return 1;
                return b.id - a.id;
              })
              .map((ride) => {
                const normalizedStatus = (ride.status || "")
                  .toLowerCase()
                  .trim();
                return (
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
                        {normalizedStatus === "scheduled"
                          ? "Scheduled"
                          : normalizedStatus === "pending"
                          ? "Requested"
                          : normalizedStatus === "accepted"
                          ? "Accepted"
                          : normalizedStatus === "in_progress"
                          ? "In Progress"
                          : ""}
                      </div>
                      <div style={{ marginTop: 2 }}>
                        <span>
                          <img
                            src={
                              vehicleOptions.find(
                                (opt) =>
                                  opt.value === ride.vehicleType
                              )?.icon || carIcon
                            }
                            alt={ride.vehicleType}
                            style={{
                              width: 22,
                              height: 22,
                              marginBottom: -4,
                              marginRight: 2,
                            }}
                          />
                          {ride.vehicleType}
                        </span>
                        {ride.destinationName && (
                          <>
                            {" "}
                            | <span>{ride.destinationName}</span>
                          </>
                        )}
                      </div>
                      {ride.scheduledAt && (
                        <div style={{ color: "#555", fontSize: 14 }}>
                          Pickup:{" "}
                          {DateTime.fromISO(ride.scheduledAt).toFormat(
                            "yyyy-MM-dd HH:mm"
                          )}
                        </div>
                      )}
                      {ride.note && (
                        <div style={{ color: "#888", fontSize: 13 }}>
                          Note: {ride.note}
                        </div>
                      )}
                      {ride.driver && (
                        <div style={{ color: "#1976D2", fontSize: 14 }}>
                          Driver: {ride.driver.name || "Assigned"} | Vehicle:{" "}
                          {ride.driver.vehicleType || "Unknown"}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {ratingRideId === ride.id ? (
                        <RateDriver
                          rideId={ride.id}
                          onRated={() => {
                            setRatingRideId(null);
                            setRideList((prev) =>
                              prev.filter((r) => r.id !== ride.id)
                            );
                          }}
                        />
                      ) : (
                        <>
                          {["pending", "scheduled"].includes(
                            normalizedStatus
                          ) && (
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
                                  fontWeight: "bold",
                                }}
                                onClick={() => handleCancelRide(ride.id)}
                              >
                                Cancel
                              </button>
                              {normalizedStatus === "scheduled" && (
                                <button
                                  style={{
                                    background: "#1976D2",
                                    color: "#fff",
                                    border: "none",
                                    padding: "0.5em 1.2em",
                                    borderRadius: 6,
                                    fontSize: 15,
                                    marginBottom: 2,
                                    fontWeight: "bold",
                                  }}
                                  onClick={() => {
                                    setSchedEditMode(true);
                                    setSchedRideId(ride.id);
                                    setSchedVehicleType(
                                      ride.vehicleType || ""
                                    );
                                    setSchedDestinationName(
                                      ride.destinationName || ""
                                    );
                                    setSchedDatetime(
                                      ride.scheduledAt
                                        ? DateTime.fromISO(
                                            ride.scheduledAt
                                          ).toFormat(
                                            "yyyy-MM-dd'T'HH:mm"
                                          )
                                        : ""
                                    );
                                    setSchedNote(ride.note || "");
                                    setScheduledModalOpen(true);
                                  }}
                                >
                                  Edit
                                </button>
                              )}
                            </>
                          )}
                          {normalizedStatus === "in_progress" && (
                            <button
                              style={{
                                background: "#388e3c",
                                color: "#fff",
                                border: "none",
                                padding: "0.5em 1.2em",
                                borderRadius: 6,
                                fontSize: 15,
                                fontWeight: "bold",
                              }}
                              onClick={() => handleMarkRideDone(ride.id)}
                            >
                              Done
                            </button>
                          )}
                          {(normalizedStatus === "accepted" ||
                            normalizedStatus === "in_progress") && (
                            <RestChatWindow
                              rideId={String(ride.id)}
                              sender={{
                                id: getCustomerIdFromStorage(),
                                name: "Customer",
                                role: "customer",
                                avatar: "",
                              }}
                              messages={
                                chatMessagesByRideId[String(ride.id)] || []
                              }
                              onSend={(text) =>
                                handleSendMessage(text, ride.id)
                              }
                              style={{
                                width: 180,
                                minHeight: 60,
                                maxHeight: 220,
                              }}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* --- Scheduled Modal --- */}
      {scheduledModalOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.3)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 10,
              padding: 24,
              minWidth: 350,
              boxShadow: "0 3px 18px #0002",
            }}
          >
            <h3 style={{ marginBottom: 16 }}>
              {schedEditMode ? "Edit Scheduled Ride" : "Schedule a Ride"}
            </h3>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Pickup Date & Time:
            </div>
            <input
              type="datetime-local"
              value={schedDatetime}
              onChange={(e) => setSchedDatetime(e.target.value)}
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div
              style={{
                marginBottom: 10,
                color: "#1976D2",
                fontWeight: "bold",
              }}
            >
              Detected pickup time zone:{" "}
              {pickupTimeZone || "Loading..."}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Vehicle Type:
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                marginBottom: 14,
              }}
            >
              {vehicleOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSchedVehicleType(opt.value)}
                  type="button"
                  style={{
                    border:
                      schedVehicleType === opt.value
                        ? "2px solid #1976D2"
                        : "2px solid #ccc",
                    background:
                      schedVehicleType === opt.value ? "#e6f0ff" : "#fff",
                    borderRadius: 8,
                    padding: "12px 16px",
                    minWidth: 80,
                    minHeight: 60,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    cursor: "pointer",
                    outline: "none",
                    boxShadow:
                      schedVehicleType === opt.value
                        ? "0 0 8px #1976D2"
                        : "0 1px 3px #eee",
                    fontWeight:
                      schedVehicleType === opt.value ? "bold" : "normal",
                    fontSize: "1.05em",
                  }}
                >
                  <img
                    src={opt.icon}
                    alt={opt.label}
                    style={{
                      width: 28,
                      height: 28,
                      marginBottom: 2,
                    }}
                  />
                  {opt.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Destination:
            </div>
            <input
              type="text"
              value={schedDestinationName}
              onChange={(e) => setSchedDestinationName(e.target.value)}
              placeholder="Type destination (e.g. Airport, Hospital)"
              style={{
                width: "100%",
                marginBottom: 10,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
            />
            <div style={{ marginBottom: 8, fontWeight: "bold" }}>
              Note for Driver:
            </div>
            <input
              type="text"
              value={schedNote}
              onChange={(e) => setSchedNote(e.target.value)}
              placeholder="Optional note for driver"
              style={{
                width: "100%",
                marginBottom: 14,
                padding: 6,
                borderRadius: 5,
                border: "1px solid #ccc",
              }}
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
                  margin: "0 8px",
                }}
                onClick={handleConfirmScheduledRide}
              >
                {schedEditMode
                  ? "Save Changes"
                  : "Confirm Scheduled Ride"}
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
                  margin: "0 8px",
                }}
                onClick={closeScheduleModal}
              >
                Cancel
              </button>
            </div>
            {schedError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {schedError}
              </div>
            )}
            {scheduledRideLimitError && (
              <div style={{ color: "#d32f2f", marginTop: 10 }}>
                {scheduledRideLimitError}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
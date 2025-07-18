import React, { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaCar,
  FaMotorcycle,
  FaBox,
  FaTruck,
  FaTruckPickup,
  FaWheelchair,
} from "react-icons/fa";
import AppMap from "../components/AppMap";
import RestChatWindow from "../components/RestChatWindow";
import markerLimo from "../assets/marker-limo.png";

// Extended vehicle types
const VEHICLE_TYPE_LABELS = {
  car: { label: "Car", icon: <FaCar /> },
  tuktuk: { label: "Tuktuk", icon: <FaMotorcycle /> },
  delivery: { label: "Delivery", icon: <FaBox /> },
  limo: {
    label: "Limo",
    icon: (
      <img
        src={markerLimo}
        alt="Limo"
        style={{
          height: 24,
          width: 48,
          objectFit: "contain",
          verticalAlign: "middle",
        }}
      />
    ),
  },
  wheelchair: { label: "Wheelchair", icon: <FaWheelchair /> },
  truck: { label: "Truck", icon: <FaTruck /> },
  water_truck: { label: "Water Truck", icon: <FaTruckPickup /> },
  tow_truck: { label: "Tow Truck", icon: <FaTruckPickup /> },
};

type RideStatus =
  | "pending"
  | "accepted"
  | "cancelled"
  | "done"
  | "arrived"
  | "in_progress"
  | "scheduled"
  | "no_show"
  | null;

type DriverInfo = { id?: string | number; name?: string; vehicleType?: string };

type ActiveRide = {
  id: string | number;
  pickupLat: number;
  pickupLng: number;
  destLat: number;
  destLng: number;
  vehicleType: keyof typeof VEHICLE_TYPE_LABELS;
  status: RideStatus;
  driver?: DriverInfo | null;
  destinationName?: string;
};

function saveChatSession(rideId: number | null, jobStatus: string | null) {
  localStorage.setItem("currentCustomerRideId", rideId ? String(rideId) : "");
  localStorage.setItem("currentCustomerJobStatus", jobStatus || "");
}
function getSavedChatSession() {
  const rideId = Number(localStorage.getItem("currentCustomerRideId"));
  const jobStatus = localStorage.getItem("currentCustomerJobStatus");
  return { rideId: rideId || null, jobStatus: jobStatus || null };
}

const API_URL =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ||
  process.env.REACT_APP_API_URL?.replace(/\/$/, "") ||
  "";

export default function CustomerDashboard() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token")
  );
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [lastFinishedRideId, setLastFinishedRideId] = useState<number | null>(
    null
  );
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [destination, setDestination] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [destinationName, setDestinationName] = useState<string>("");
  const [vehicleType, setVehicleType] = useState<
    keyof typeof VEHICLE_TYPE_LABELS | ""
  >("");
  const [pickupSet, setPickupSet] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const navigate = useNavigate();

  // Session Restore and Polling
  useEffect(() => {
    async function restoreRide() {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/api/rides/current`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = res.ok ? await res.json() : null;
        if (
          data &&
          data.rideId &&
          ["accepted", "in_progress", "pending"].includes(data.rideStatus)
        ) {
          setActiveRide({
            id: data.rideId,
            pickupLat: data.originLat,
            pickupLng: data.originLng,
            destLat: data.destLat,
            destLng: data.destLng,
            vehicleType: (data.vehicleType || "").toLowerCase(),
            status: data.rideStatus,
            driver: data.driver,
            destinationName: data.destinationName,
          });
          setPickupSet(true);
          setPickupLocation({ lat: data.originLat, lng: data.originLng });
          setDestination({ lat: data.destLat, lng: data.destLng });
          setDestinationName(data.destinationName || "");
          setRideStatus(data.rideStatus);
        } else {
          setActiveRide(null);
          setRideStatus(null);
        }
      } catch {
        setActiveRide(null);
        setRideStatus(null);
      }
    }
    restoreRide();
  }, []);

  // Ride Status Poll
  useEffect(() => {
    let interval: NodeJS.Timeout | undefined;
    if (
      activeRide &&
      ["pending", "accepted", "in_progress"].includes(activeRide.status || "")
    ) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(
            `${API_URL}/api/rides/${activeRide.id}/status`
          );
          const data = await res.json();
          if (data.status && data.status !== rideStatus) {
            setRideStatus(data.status);
            setActiveRide((r) => (r ? { ...r, status: data.status } : r));
          }
          if (
            activeRide.status === "pending" &&
            (data.status === "accepted" || data.status === "in_progress")
          ) {
            setChatOpen(true);
          }
          if (["done", "cancelled", "no_show"].includes(data.status)) {
            setChatOpen(false);
            setLastFinishedRideId(Number(activeRide.id));
            setShowRating(true);
            setActiveRide(null);
            setRideStatus(null);
          }
        } catch {}
      }, 3000);
    }
    return () => interval && clearInterval(interval);
  }, [activeRide, rideStatus]);

  // Chat Polling
  useEffect(() => {
    const rideId = activeRide?.id;
    if (
      !rideId ||
      !(chatOpen && (activeRide.status === "accepted" || activeRide.status === "in_progress"))
    ) {
      setChatMessages([]);
      return;
    }
    setChatId(String(rideId));
    let polling = true;
    async function fetchMessages() {
      if (!polling) return;
      try {
        const res = await fetch(
          `${API_URL}/api/rides/${rideId}/chat/messages`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          }
        );
        if (res.ok) {
          const msgs = await res.json();
          setChatMessages(
            Array.isArray(msgs)
              ? msgs
                  .filter(Boolean)
                  .map((m, idx) => ({
                    ...m,
                    id:
                      m?.id ||
                      m?._id ||
                      m?.timestamp ||
                      `${Date.now()}_${idx}`,
                    sender:
                      m?.sender ?? {
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
      setChatMessages([]);
    };
  }, [activeRide, chatOpen, token]);

  // Send Chat Message
  const handleSendMessage = async (text: string) => {
    if (!chatId) return;
    const customerId = Number(localStorage.getItem("userId"));
    await fetch(`${API_URL}/api/rides/${chatId}/chat/messages`, {
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
    // message will appear on next poll
  };

  // Request Ride (Regular)
  async function handleRequestRide() {
    if (!pickupLocation || !destination || !vehicleType || !destinationName) {
      setErrorMsg(
        "Pickup, destination, destination name, and vehicle type required."
      );
      setWaiting(false);
      return;
    }
    const token = localStorage.getItem("token");
    const customerId = Number(localStorage.getItem("userId"));
    if (!token || !customerId) {
      setErrorMsg("Not logged in.");
      setWaiting(false);
      return;
    }
    setWaiting(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/rides/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
        setErrorMsg(data.error || "Failed to create ride.");
        setWaiting(false);
        return;
      }
      setActiveRide({
        id: data.rideId || data.id,
        pickupLat: pickupLocation.lat,
        pickupLng: pickupLocation.lng,
        destLat: destination.lat,
        destLng: destination.lng,
        vehicleType: vehicleType as keyof typeof VEHICLE_TYPE_LABELS,
        status: "pending",
        destinationName,
      });
      setPickupSet(true);
      setWaiting(false);
      setChatOpen(false);
      setShowRating(false);
      setLastFinishedRideId(null);
    } catch (err: any) {
      setErrorMsg("Network or server error.");
      setWaiting(false);
    }
  }

  // Cancel Ride
  async function handleCancelRide(rideIdToCancel: string | number) {
    setWaiting(true);
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/api/rides/${rideIdToCancel}/cancel`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      setChatOpen(false);
      setLastFinishedRideId(Number(rideIdToCancel));
      setShowRating(true);
      setActiveRide(null);
      setWaiting(false);
    } catch (err) {
      setErrorMsg("Network or server error.");
      setWaiting(false);
    }
  }

  // Reset All
  function resetAll() {
    setActiveRide(null);
    setRideStatus(null);
    setChatOpen(false);
    setShowRating(false);
    setLastFinishedRideId(null);
    setPickupSet(false);
    setVehicleType("");
    setErrorMsg(null);
    setWaiting(false);
    setPickupLocation(null);
    setDestination(null);
    setDestinationName("");
  }

  // RATING
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
        {error && <div style={{ color: "#d32f2f", marginTop: 8 }}>{error}</div>}
      </form>
    );
  }

  // UI: Active Ride (pending/accepted/in_progress)
  if (
    activeRide &&
    ["pending", "accepted", "in_progress"].includes(activeRide.status || "")
  ) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        {activeRide.status === "pending" && (
          <>
            <h2>Ride Requested</h2>
            <div style={{ margin: 10 }}>
              Waiting for a driver to accept your ride...
            </div>
            <button
              style={{
                background: "#f44336",
                color: "#fff",
                border: "none",
                padding: "0.7em 1.4em",
                borderRadius: 6,
                fontSize: 16,
                margin: "14px 0 8px 0",
              }}
              onClick={() => handleCancelRide(activeRide.id)}
              disabled={waiting}
            >
              Cancel Ride
            </button>
          </>
        )}
        {(activeRide.status === "accepted" ||
          activeRide.status === "in_progress") && (
          <>
            <h2>
              {activeRide.status === "accepted"
                ? "Driver Accepted"
                : "On Trip"}
            </h2>
            <div style={{ margin: 10 }}>
              <b>Driver:</b> {activeRide.driver?.name || "Assigned driver"} <br />
              <b>Vehicle:</b>{" "}
              {activeRide.driver?.vehicleType ||
                VEHICLE_TYPE_LABELS[activeRide.vehicleType]?.label}
            </div>
            <button
              style={{
                background: "#f44336",
                color: "#fff",
                border: "none",
                padding: "0.7em 1.4em",
                borderRadius: 6,
                fontSize: 16,
                margin: "14px 0 8px 0",
              }}
              onClick={() => handleCancelRide(activeRide.id)}
              disabled={waiting}
            >
              Cancel Ride
            </button>
            {chatOpen && (
              <div
                style={{
                  margin: "32px auto 0 auto",
                  display: "flex",
                  justifyContent: "center",
                  height: "250px",
                  maxHeight: "250px",
                  minHeight: "120px",
                  width: "100%",
                  maxWidth: "500px",
                }}
              >
                <RestChatWindow
                  rideId={activeRide.id}
                  sender={{
                    id: Number(localStorage.getItem("userId")),
                    name: "Customer",
                    role: "customer",
                    avatar: "",
                  }}
                  messages={chatMessages}
                  onSend={handleSendMessage}
                  style={{ height: "100%" }}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // After ride is done/cancelled, show rating and allow new ride request
  if (showRating && lastFinishedRideId) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <RateDriver rideId={lastFinishedRideId} onRated={resetAll} />
        <button
          style={{
            marginTop: 24,
            background: "#1976D2",
            color: "#fff",
            fontWeight: "bold",
            fontSize: 18,
            padding: "0.8em 2em",
            borderRadius: 6,
            border: "none",
          }}
          onClick={resetAll}
        >
          Request New Ride
        </button>
      </div>
    );
  }

  // Main homepage UI
  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ textAlign: "center" }}>Request a Ride</h2>
      {errorMsg && (
        <div style={{ color: "#d32f2f", textAlign: "center" }}>{errorMsg}</div>
      )}
      <AppMap
        jobs={[]}
        driverLocation={pickupLocation || undefined}
        driverVehicleType={vehicleType || undefined}
        showDriverMarker={true}
        vehicleTypeLabels={VEHICLE_TYPE_LABELS}
        onAcceptRide={undefined}
        onMapClick={(e) => {
          if (!pickupSet) {
            setPickupLocation({ lat: e.latlng.lat, lng: e.latlng.lng });
            setPickupSet(true);
          } else {
            setDestination({ lat: e.latlng.lat, lng: e.latlng.lng });
          }
        }}
      />
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
          {Object.entries(VEHICLE_TYPE_LABELS).map(([type, info]) => (
            <button
              key={type}
              onClick={() => setVehicleType(type as keyof typeof VEHICLE_TYPE_LABELS)}
              type="button"
              style={{
                border:
                  vehicleType === type
                    ? "2px solid #1976D2"
                    : "2px solid #ccc",
                background: vehicleType === type ? "#e6f0ff" : "#fff",
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
                boxShadow:
                  vehicleType === type
                    ? "0 0 8px #1976D2"
                    : "0 1px 3px #eee",
                fontWeight: vehicleType === type ? "bold" : "normal",
                fontSize: "1.05em",
              }}
            >
              {info.icon}
              {info.label}
            </button>
          ))}
        </div>
      </div>
      <div
        style={{
          margin: "24px 0",
          textAlign: "center",
          display: "flex",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <button
          disabled={
            waiting ||
            !pickupLocation ||
            !destination ||
            !vehicleType ||
            !destinationName
          }
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
      </div>
      {pickupLocation && (
        <div style={{ textAlign: "center", color: "#888" }}>
          Pickup Location: {pickupLocation.lat.toFixed(4)},{" "}
          {pickupLocation.lng.toFixed(4)}
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
          onChange={(e) => setDestinationName(e.target.value)}
          placeholder="Type destination (e.g. Airport, Hospital)"
          style={{
            width: 260,
            padding: 6,
            borderRadius: 5,
            border: "1px solid #ccc",
          }}
        />
        <div style={{ fontSize: 13, color: "#888" }}>
          Click map to set pickup, then click again to set destination. Type the
          destination name for clarity.
        </div>
      </div>
    </div>
  );
}
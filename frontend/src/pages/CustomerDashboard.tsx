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

// --- VEHICLE ICON OPTIONS ---
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
  createdAt?: string;
  cancelledReason?: string; // this should be set by backend for auto-cancelled rides
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

export default function CustomerDashboard() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem("token")
  );
  const [userLocation, setUserLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<{
    lng: number;
    lat: number;
  } | null>(null);
  const [pickupSet, setPickupSet] = useState(false);
  const [rideId, setRideId] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<string>("");
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideStatus, setRideStatus] = useState<RideStatus>(null);
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [showDoneActions, setShowDoneActions] = useState(false);
  const [emergencyLocations, setEmergencyLocations] = useState<
    EmergencyLocation[]
  >([]);
  const [chatMessagesByRideId, setChatMessagesByRideId] = useState<{
    [rideId: string]: any[];
  }>({});
  const [showRating, setShowRating] = useState(false);
  const [showDoneButton, setShowDoneButton] = useState(false);
  const [ratingRideId, setRatingRideId] = useState<number | null>(null);

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

  const [pickupTimeZone, setPickupTimeZone] = useState<string>("UTC");
  const [localTime, setLocalTime] = useState<string>("");

  const [rideList, setRideList] = useState<RideListItem[]>([]);
  const [rideListLoading, setRideListLoading] = useState(false);

  // --- POLLING CONTROL ---
  const lastStatusesRef = useRef<{ [id: number]: string }>({});
  const pollingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Button logic: count rides ---
  const activeRides = rideList.filter(
    r => ["pending", "accepted", "in_progress"].includes((r.status || "").toLowerCase().trim())
  );
  const scheduledRides = rideList.filter(
    r => (r.status || "").toLowerCase().trim() === "scheduled"
  );
  const activeRidesCount = activeRides.length;
  const scheduledRidesCount = scheduledRides.length;

  // --- Button error states ---
  const [activeRideLimitError, setActiveRideLimitError] = useState<string | null>(null);
  const [scheduledRideLimitError, setScheduledRideLimitError] = useState<string | null>(null);

  // --- DRIVER MARKER STATE for tracking driver car on map ---
  const [driverMarker, setDriverMarker] = useState<{ lat: number; lng: number } | null>(null);
  const driverMarkerTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- New: Periodic location update every 1 minute ---
  useEffect(() => {
    let watcherId: number | null = null;
    let locationInterval: NodeJS.Timeout | null = null;

    function sendLocationToBackend(lat: number, lng: number) {
      const customerId = getCustomerIdFromStorage();
      if (!customerId) return;
      fetch(`${API_URL}/api/location/update`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          customerId,
          lat,
          lng,
          timestamp: Date.now(),
        }),
      });
    }

    function updateLocationAndSend() {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = {
            lng: pos.coords.longitude,
            lat: pos.coords.latitude,
          };
          setUserLocation(loc);
          setPickupLocation((prev) =>
            prev && prev.lat && prev.lng ? prev : loc
          );
          sendLocationToBackend(loc.lat, loc.lng);
        },
        () => {
          // fallback: Cairo center
          const loc = { lng: 31.2357, lat: 30.0444 };
          setUserLocation(loc);
          setPickupLocation((prev) => (prev ? prev : loc));
          sendLocationToBackend(loc.lat, loc.lng);
        }
      );
    }

    // Initial location & backend update
    updateLocationAndSend();

    // Set up interval
    locationInterval = setInterval(updateLocationAndSend, 60000);

    return () => {
      if (locationInterval) clearInterval(locationInterval);
      if (watcherId) navigator.geolocation.clearWatch(watcherId);
    };
  }, [token]);

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
      const data = (await res.json()) as {
        zoneName?: string;
        message?: string;
        status?: string;
      };
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

  function openScheduleModal() {
    setSchedEditMode(false);
    setSchedRideId(null);
    setSchedVehicleType("");
    setSchedDestinationName("");
    setSchedDatetime("");
    setSchedNote("");
    setSchedError(null);
    setScheduledModalOpen(true);
  }
  function closeScheduleModal() {
    setScheduledModalOpen(false);
    setSchedError(null);
    setSchedEditMode(false);
    setSchedRideId(null);
  }
  function getScheduledUTC(datetimeLocal: string, timezone: string): string {
    if (!datetimeLocal || !timezone) return "";
    const dt = DateTime.fromISO(datetimeLocal, { zone: timezone });
    return dt.toUTC().toISO();
  }

  useEffect(() => {
    if (pickupLocation && pickupLocation.lat && pickupLocation.lng) {
      getTimeZoneFromCoords(pickupLocation.lat, pickupLocation.lng)
        .then((zone) => setPickupTimeZone(zone || "UTC"))
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
      headers: { "Content-Type": "text/plain" },
    })
      .then((res) => res.json())
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
              name: el.tags.name || type.charAt(0).toUpperCase() + type.slice(1),
              lat: el.lat,
              lng: el.lon,
              phone: el.tags.phone,
              icon,
            });
          }
        }
        setEmergencyLocations(locations);
      })
      .catch(() => {});
  }, [userLocation]);

  // SMART POLLING: only refresh when status changes
  const fetchRidesSmart = useCallback(async () => {
    const customerId = getCustomerIdFromStorage();
    if (!customerId) return;
    setRideListLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/rides/all?customerId=${customerId}`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      if (res.ok) {
        const rides: RideListItem[] = await res.json();
        const filtered = rides.filter((r) =>
          // show all rides, including cancelled for notification
          ["pending", "accepted", "in_progress", "scheduled", "cancelled"].includes(
            (r.status || "").toLowerCase().trim()
          )
        );
        let changed = false;
        for (const r of filtered) {
          if (lastStatusesRef.current[r.id] !== (r.status || "")) {
            changed = true;
            break;
          }
        }
        if (changed || rideList.length !== filtered.length) {
          setRideList(filtered);
          const nextStatuses: { [id: number]: string } = {};
          for (const r of filtered) {
            nextStatuses[r.id] = r.status || "";
          }
          lastStatusesRef.current = nextStatuses;
        }
      }
    } catch (err) {}
    setRideListLoading(false);
  }, [token, rideList.length]);

  useEffect(() => {
    fetchRidesSmart();
    // Set up polling every 4 seconds, but only for active rides
    if (
      rideList.some((r) =>
        ["pending", "scheduled", "accepted", "in_progress"].includes(
          (r.status || "").toLowerCase().trim()
        )
      )
    ) {
      pollingTimerRef.current = setInterval(fetchRidesSmart, 4000);
    } else {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    }
    return () => {
      if (pollingTimerRef.current) clearInterval(pollingTimerRef.current);
    };
  }, [fetchRidesSmart, rideList]);

  // --- DRIVER MARKER UPDATE: Show car on customer map when accepted/in_progress for up to 15min ---
  useEffect(() => {
    // Find an accepted or in_progress ride with driver location
    const acceptedRide = rideList.find(
      (r) =>
        ["accepted", "in_progress"].includes((r.status || "").toLowerCase()) &&
        r.driver &&
        typeof r.driver.lastKnownLat === "number" &&
        typeof r.driver.lastKnownLng === "number"
    );

    if (!acceptedRide || !acceptedRide.driver) {
      setDriverMarker(null);
      if (driverMarkerTimeoutRef.current) {
        clearTimeout(driverMarkerTimeoutRef.current);
        driverMarkerTimeoutRef.current = null;
      }
      return;
    }

    // Only show marker for 15min after acceptance
    let hideAfterMs: number | null = null;
    let acceptedAtStr = acceptedRide.driver.acceptedAt;
    if (acceptedAtStr) {
      const acceptedAt = DateTime.fromISO(acceptedAtStr).toMillis();
      const now = Date.now();
      const msSinceAccepted = now - acceptedAt;
      if (msSinceAccepted > 15 * 60 * 1000) {
        setDriverMarker(null);
        if (driverMarkerTimeoutRef.current) {
          clearTimeout(driverMarkerTimeoutRef.current);
          driverMarkerTimeoutRef.current = null;
        }
        return;
      }
      hideAfterMs = 15 * 60 * 1000 - msSinceAccepted;
    }

    setDriverMarker({
      lat: acceptedRide.driver.lastKnownLat!,
      lng: acceptedRide.driver.lastKnownLng!,
    });

    if (driverMarkerTimeoutRef.current) clearTimeout(driverMarkerTimeoutRef.current);
    if (hideAfterMs) {
      driverMarkerTimeoutRef.current = setTimeout(
        () => setDriverMarker(null),
        hideAfterMs
      );
    }
    return () => {
      if (driverMarkerTimeoutRef.current) clearTimeout(driverMarkerTimeoutRef.current);
    };
  }, [rideList]);

  // --- Chat polling for all rides with accepted/in_progress status ---
  useEffect(() => {
    let timers: { [rideId: string]: NodeJS.Timeout } = {};
    rideList.forEach((ride) => {
      const status = (ride.status || "").toLowerCase().trim();
      if (status === "accepted" || status === "in_progress") {
        const rideIdStr = String(ride.id);
        const poll = async () => {
          try {
            const token = localStorage.getItem("token");
            const res = await fetch(
              `${API_URL}/api/rides/${rideIdStr}/chat/messages`,
              {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
              }
            );
            if (res.ok) {
              const msgs = await res.json();
              setChatMessagesByRideId((prev) => ({
                ...prev,
                [rideIdStr]: Array.isArray(msgs)
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
                          m?.sender ??
                          {
                            id: m?.senderId ?? "unknown",
                            name: m?.senderName ?? "",
                            role: m?.senderRole ?? "",
                            avatar: m?.senderAvatar ?? "",
                          },
                      }))
                  : [],
              }));
            }
          } catch {
            setChatMessagesByRideId((prev) => ({ ...prev, [rideIdStr]: [] }));
          }
        };
        poll();
        timers[rideIdStr] = setInterval(poll, 3000);
      }
    });
    return () => {
      Object.values(timers).forEach(clearInterval);
    };
  }, [rideList]);

  useEffect(() => {
    if (activeRidesCount < 3) setActiveRideLimitError(null);
    if (scheduledRidesCount < 5) setScheduledRideLimitError(null);
  }, [activeRidesCount, scheduledRidesCount]);

  const handleSendMessage = async (text: string, rideIdForChat: number) => {
    const customerId = getCustomerIdFromStorage();
    if (!rideIdForChat || !customerId) return;
    await fetch(`${API_URL}/api/rides/${rideIdForChat}/chat/messages`, {
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

  async function handleRequestRide() {
    if (activeRidesCount >= 3) {
      setActiveRideLimitError("Only 3 active rides are allowed. Please cancel rides below to request a new one.");
      return;
    }
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
          Authorization: `Bearer ${token}`,
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
      setActiveRideLimitError(null);
      fetchRidesSmart();
    } catch (err: any) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  async function handleConfirmScheduledRide() {
    if (scheduledRidesCount >= 5) {
      setScheduledRideLimitError("Only 5 scheduled rides are allowed. Please cancel rides below to request a new one.");
      return;
    }
    if (
      !userLocation ||
      !schedDatetime ||
      !schedDestinationName ||
      !schedVehicleType
    ) {
      setSchedError("All fields are required.");
      return;
    }
    const token = localStorage.getItem("token");
    const customerId = getCustomerIdFromStorage();
    if (!token || customerId === null) {
      setSchedError("Not logged in.");
      return;
    }
    setSchedWaiting(true);
    setSchedError(null);

    const scheduledAtUTC = getScheduledUTC(
      schedDatetime,
      pickupTimeZone || "UTC"
    );

    try {
      let res, data;
      if (schedEditMode && schedRideId) {
        res = await fetch(`${API_URL}/api/rides/schedule/${schedRideId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customerId,
            originLat: userLocation.lat,
            originLng: userLocation.lng,
            destLat: userLocation.lat,
            destLng: userLocation.lng,
            vehicleType: schedVehicleType,
            destinationName: schedDestinationName,
            scheduledAt: scheduledAtUTC,
            note: schedNote,
          }),
        });
      } else {
        res = await fetch(`${API_URL}/api/rides/schedule`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            customerId,
            originLat: userLocation.lat,
            originLng: userLocation.lng,
            destLat: userLocation.lat,
            destLng: userLocation.lng,
            vehicleType: schedVehicleType,
            destinationName: schedDestinationName,
            scheduledAt: scheduledAtUTC,
            note: schedNote,
          }),
        });
      }
      data = await res.json();
      if (!res.ok) {
        setSchedError(data.error || "Failed to schedule ride.");
        setSchedWaiting(false);
        return;
      }
      setScheduledModalOpen(false);
      setPickupSet(true);
      setRideId(data.rideId || data.id);
      setRideStatus("scheduled");
      setWaiting(false);
      setSchedWaiting(false);
      setSchedEditMode(false);
      setSchedRideId(null);
      setSchedVehicleType("");
      setSchedDestinationName("");
      setSchedDatetime("");
      setSchedNote("");
      setSchedError(null);
      setScheduledRideLimitError(null);
      fetchRidesSmart();
    } catch (err: any) {
      setSchedError("Network or server error.");
      setSchedWaiting(false);
    }
  }

  async function handleCancelRide(rideIdToCancel: number) {
    setWaiting(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/rides/${rideIdToCancel}/cancel`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel ride.");
        setWaiting(false);
        return;
      }
      setRideStatus("cancelled");
      setShowDoneActions(true);
      setWaiting(false);
      setRideList((prev) => prev.filter((r) => r.id !== rideIdToCancel));
      setActiveRideLimitError(null);
      setScheduledRideLimitError(null);
      fetchRidesSmart();
    } catch (err) {
      setError("Network or server error.");
      setWaiting(false);
    }
  }

  async function handleMarkRideDone(rideIdToMark: number) {
    setWaiting(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(
        `${API_URL}/api/rides/${rideIdToMark}/done`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to mark ride as done.");
        setWaiting(false);
        return;
      }
      setWaiting(false);
      setRatingRideId(rideIdToMark); // show rating UI for this ride
      setActiveRideLimitError(null);
      setScheduledRideLimitError(null);
      fetchRidesSmart();
    } catch (err) {
      setError("Network or server error.");
      setWaiting(false);
    }
  }

  // --- LOGOUT ---
  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    window.location.reload();
  }

  // --- Map Ref for Center Button ---
  const mapRef = useRef<L.Map | null>(null);

  // --- UI Rendering Section ---
  return (
    <div style={{ padding: 24, minHeight: "100vh", position: "relative" }}>
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

      {/* Map section with center button */}
      {userLocation && (
        <div style={{ position: "relative", maxWidth: 640, margin: "0 auto" }}>
          <button
            onClick={() => {
              if (userLocation && mapRef.current) {
                mapRef.current.setView([userLocation.lat, userLocation.lng], 13);
              }
            }}
            style={{
              position: "absolute",
              top: 18,
              right: 18,
              zIndex: 500,
              background: "#fff",
              border: "1px solid #1976D2",
              color: "#1976D2",
              borderRadius: "50%",
              width: 44,
              height: 44,
              fontSize: 22,
              boxShadow: "0 2px 8px #0003",
              cursor: "pointer"
            }}
            title="Center map on my location"
            aria-label="Center map"
          >⌖</button>
          <MapContainer
            center={[userLocation.lat, userLocation.lng]}
            zoom={13}
            style={{
              height: 320,
              borderRadius: 8,
              width: "100%",
            }}
            ref={mapRef as any}
            whenCreated={(map) => {
              mapRef.current = map;
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
        </div>
      )}

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
                border:
                  vehicleType === opt.value
                    ? "2px solid #1976D2"
                    : "2px solid #ccc",
                background:
                  vehicleType === opt.value ? "#e6f0ff" : "#fff",
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
                  vehicleType === opt.value
                    ? "0 0 8px #1976D2"
                    : "0 1px 3px #eee",
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
          disabled={
            waiting ||
            !pickupLocation ||
            !vehicleType
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
          disabled={
            waiting
          }
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
        <h3 style={{ marginBottom: 8 }}>
          See your active and scheduled rides below. You can edit, cancel, or chat with your driver.
        </h3>
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
                // Active rides first, then scheduled, then cancelled, then by scheduledAt/createdAt
                const statusOrder = (status: string | undefined) => {
                  switch ((status || "").toLowerCase().trim()) {
                    case "in_progress": return 1;
                    case "accepted": return 2;
                    case "pending": return 3;
                    case "scheduled": return 4;
                    case "cancelled": return 5;
                    default: return 10;
                  }
                };
                const sa = statusOrder(a.status);
                const sb = statusOrder(b.status);
                if (sa !== sb) return sa - sb;
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

                // Only show cancel/edit/done/rate/chat for non-cancelled rides
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
                      opacity: normalizedStatus === "cancelled" ? 0.65 : 1,
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
                          : normalizedStatus === "cancelled"
                          ? "Cancelled"
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
                      {/* --- Cancelled ride notification --- */}
                      {normalizedStatus === "cancelled" && (
                        <div style={{ color: "#d32f2f", fontWeight: "bold", fontSize: 14 }}>
                          {ride.cancelledReason
                            ? ride.cancelledReason
                            : "This ride was automatically cancelled because no driver accepted your request within 1 hour. Please request a new ride."}
                        </div>
                      )}
                    </div>
                    {/* --- Action Buttons and Chat/Rating --- */}
                    {normalizedStatus !== "cancelled" && (
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
                                  width: 330,
                                  minHeight: 60,
                                  maxHeight: 220,
                                }}
                                open={true}
                              />
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* --- Scheduled Ride Modal --- */}
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

      {/* --- Logout Button --- */}
      <button
        onClick={handleLogout}
        style={{
          position: "fixed",
          right: 24,
          bottom: 24,
          zIndex: 2000,
          background: "#1976D2",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: 56,
          height: 56,
          fontSize: 24,
          boxShadow: "0 2px 10px #0002",
          cursor: "pointer",
        }}
        title="Logout"
        aria-label="Logout"
      >
        ⎋
      </button>
    </div>
  );
}
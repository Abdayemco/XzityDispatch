import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";

// --- Import all vehicle icons (same as dashboard) ---
import carIcon from "../assets/marker-car.png";
import deliveryIcon from "../assets/marker-delivery.png";
import tuktukIcon from "../assets/marker-toktok.png";
import truckIcon from "../assets/marker-truck.png";
import waterTruckIcon from "../assets/marker-watertruck.png";
import towTruckIcon from "../assets/marker-towtruck.png";
import wheelchairIcon from "../assets/marker-wheelchair.png";
import limoIcon from "../assets/marker-limo.png";
import markerCustomer from "../assets/marker-customer.png"; // for ride origins

// --- Utility to get the correct vehicle icon PNG for a vehicleType ---
const VEHICLE_TYPE_MARKERS: Record<string, string> = {
  car: carIcon,
  CAR: carIcon,
  delivery: deliveryIcon,
  DELIVERY: deliveryIcon,
  tuktuk: tuktukIcon,
  TUKTUK: tuktukIcon,
  truck: truckIcon,
  TRUCK: truckIcon,
  water_truck: waterTruckIcon,
  WATER_TRUCK: waterTruckIcon,
  tow_truck: towTruckIcon,
  TOW_TRUCK: towTruckIcon,
  wheelchair: wheelchairIcon,
  WHEELCHAIR: wheelchairIcon,
  limo: limoIcon,
  LIMO: limoIcon,
};

function getVehicleMarkerIcon(vehicleType: string | undefined): string {
  if (!vehicleType) return carIcon;
  return VEHICLE_TYPE_MARKERS[vehicleType] || VEHICLE_TYPE_MARKERS[vehicleType.toLowerCase()] || carIcon;
}

// --- Utility: create a Leaflet icon with optional grayscale ---
function createLeafletIcon(url: string, w = 32, h = 41, grayscale = false) {
  // Use an HTML divIcon to apply CSS grayscale filter if needed
  if (grayscale) {
    return L.divIcon({
      className: "",
      html: `<img src="${url}" style="width:${w}px;height:${h}px;filter: grayscale(100%);" />`,
      iconSize: [w, h],
      iconAnchor: [w / 2, h],
      popupAnchor: [0, -h + 10],
      shadowUrl: undefined,
    });
  } else {
    return L.icon({
      iconUrl: url,
      iconSize: [w, h],
      iconAnchor: [w / 2, h],
      popupAnchor: [0, -h + 10],
      shadowUrl: undefined,
    });
  }
}

// --- Admin marker (blue) ---
const adminIcon = L.icon({
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-blue.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-shadow.png"
});

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

const excludedStatuses = ["completed", "canceled", "cancelled", "done"];

type Driver = {
  id: string | number;
  name?: string;
  phone?: string;
  vehicleType?: string;
  lat: number;
  lng: number;
  online?: boolean;
};
type Customer = {
  id: string | number;
  name?: string;
  phone?: string;
  vehicleType?: string;
  lat: number;
  lng: number;
  online?: boolean;
};
type Ride = {
  id: string | number;
  customer?: { name?: string; id?: string | number };
  customerId?: string | number;
  status?: string;
  originLat: number;
  originLng: number;
  destLat?: number;
  destLng?: number;
  vehicleType?: string;
};

export default function AdminLiveMap() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mapCenter, setMapCenter] = useState<LatLngExpression | null>(null);
  const [adminLocation, setAdminLocation] = useState<LatLngExpression | null>(null);
  const mapZoom = 12;
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/login", { replace: true });
    }
  }, [token, navigate]);

  useEffect(() => {
    let didCancel = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!didCancel) {
          const loc: LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
          setMapCenter(loc);
          setAdminLocation(loc);
        }
      },
      () => {
        if (!didCancel) {
          setMapCenter([30.0444, 31.2357]);
          setAdminLocation(null);
        }
      }
    );
    setTimeout(() => {
      if (!didCancel && mapCenter === null) setMapCenter([30.0444, 31.2357]);
    }, 3000);
    return () => { didCancel = true; };
  }, []);

  async function fetchData() {
    setError("");
    setLoading(true);
    try {
      const headers = {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      };
      const [driversRes, customersRes, ridesRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/map/drivers`, { headers, credentials: "include" }),
        fetch(`${API_URL}/api/admin/map/customers`, { headers, credentials: "include" }),
        fetch(`${API_URL}/api/admin/rides`, { headers, credentials: "include" }),
      ]);
      if (!driversRes.ok || !customersRes.ok || !ridesRes.ok) {
        let msg = "Failed to fetch map data.";
        if (!driversRes.ok) {
          try { const data = await driversRes.json(); msg = data.error || msg; } catch {}
        }
        if (!customersRes.ok) {
          try { const data = await customersRes.json(); msg = data.error || msg; } catch {}
        }
        if (!ridesRes.ok) {
          try { const data = await ridesRes.json(); msg = data.error || msg; } catch {}
        }
        throw new Error(msg + ` (${driversRes.status}/${customersRes.status}/${ridesRes.status})`);
      }
      const driversData = await driversRes.json();
      const customersData = await customersRes.json();
      const ridesData = await ridesRes.json();
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setRides(Array.isArray(ridesData) ? ridesData : []);
    } catch (e: any) {
      setError(e.message || "Failed to fetch map data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!token) return;
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [token]);

  const filteredRides = rides.filter(
    (r) =>
      r.status &&
      !excludedStatuses.includes(r.status.toLowerCase())
  );

  // Helper: does this customer have a live ride?
  function customerHasLiveRide(customer: Customer) {
    return filteredRides.some(
      (ride) =>
        (ride.customer?.id === customer.id || ride.customerId === customer.id)
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ textAlign: "center" }}>
        Admin - Live Map
        <button
          onClick={() => navigate("/admin")}
          style={{
            float: "right",
            margin: 4,
            padding: "7px 16px",
            background: "#1976D2",
            color: "#fff",
            border: "none",
            borderRadius: 7,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 15
          }}
        >
          Back to Admin
        </button>
      </h2>
      {error && (
        <div style={{ color: "red", textAlign: "center", marginBottom: 10 }}>{error}</div>
      )}
      {!mapCenter ? (
        <div style={{ textAlign: "center", marginTop: 40 }}>Getting your location...</div>
      ) : (
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{
            height: 520,
            width: "100%",
            borderRadius: 10,
            boxShadow: "0 2px 10px #0001",
            margin: "0 auto",
            maxWidth: 900
          }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {/* Admin marker */}
          {adminLocation && (
            <Marker position={adminLocation} icon={adminIcon}>
              <Popup>
                <b>You (Admin)</b>
              </Popup>
            </Marker>
          )}
          {/* Driver markers (grayscale vehicle PNG) */}
          {drivers.map(driver => (
            driver.lat && driver.lng ? (
              <Marker
                key={`driver-${driver.id}`}
                position={[driver.lat, driver.lng]}
                icon={createLeafletIcon(getVehicleMarkerIcon(driver.vehicleType), 32, 41, true)} // grayscale
              >
                <Popup>
                  <b>Driver:</b> {driver.name || driver.phone || driver.id}
                  <br />
                  <b>Vehicle:</b> {driver.vehicleType || "Unknown"}
                  <br />
                  <b>Status:</b> {driver.online ? "Online" : "Offline"}
                </Popup>
              </Marker>
            ) : null
          ))}
          {/* Customer markers: show vehicle PNG only if NOT in a live ride */}
          {customers.map(customer => (
            customer.lat && customer.lng && !customerHasLiveRide(customer) ? (
              <Marker
                key={`customer-${customer.id}`}
                position={[customer.lat, customer.lng]}
                icon={createLeafletIcon(getVehicleMarkerIcon(customer.vehicleType), 32, 41, false)}
              >
                <Popup>
                  <b>Customer:</b> {customer.name || customer.phone || customer.id}
                  <br />
                  <b>Vehicle:</b> {customer.vehicleType || "Unknown"}
                  <br />
                  <b>Status:</b> {customer.online ? "Online" : "Offline"}
                </Popup>
              </Marker>
            ) : null
          ))}
          {/* Ride origin markers (marker-customer.png) */}
          {filteredRides.map(ride => (
            ride.originLat && ride.originLng && (
              <Marker
                key={`ride-customer-${ride.id}`}
                position={[ride.originLat, ride.originLng]}
                icon={createLeafletIcon(markerCustomer, 32, 41, false)}
              >
                <Popup>
                  <b>Customer:</b> {ride.customer?.name || ride.customerId}
                  <br />
                  <b>Ride ID:</b> {ride.id}
                  <br />
                  <b>Status:</b> {ride.status}
                  <br />
                  <b>Origin:</b> {ride.originLat.toFixed(4)}, {ride.originLng.toFixed(4)}
                  <br />
                  <b>Destination:</b> {ride.destLat?.toFixed(4)}, {ride.destLng?.toFixed(4)}
                </Popup>
              </Marker>
            )
          ))}
          {/* Ride polylines */}
          {filteredRides.map(ride => (
            ride.originLat && ride.originLng && ride.destLat && ride.destLng ? (
              <Polyline
                key={`poly-${ride.id}`}
                positions={[
                  [ride.originLat, ride.originLng],
                  [ride.destLat, ride.destLng]
                ]}
                pathOptions={{ color: "#388e3c", weight: 3, dashArray: "5,10" }}
              />
            ) : null
          ))}
        </MapContainer>
      )}
      <div style={{ textAlign: "center", marginTop: 16, color: "#555" }}>
        Showing <b>{drivers.length}</b> drivers, <b>{customers.length}</b> customers, and <b>{filteredRides.length}</b> rides (excluding completed/canceled).
      </div>
    </div>
  );
}
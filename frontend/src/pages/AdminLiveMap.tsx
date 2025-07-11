import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline } from "react-leaflet";
import L, { LatLngExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useNavigate } from "react-router-dom";

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
};

// Default Leaflet color marker icons from https://github.com/pointhi/leaflet-color-markers
const adminIcon = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-blue.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-shadow.png"
});
const driverIcon = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-yellow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-shadow.png"
});
const customerIcon = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-shadow.png"
});

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, "")
  : "";

const excludedStatuses = ["completed", "canceled", "cancelled", "done"];

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
      // Use new endpoints for only online drivers/customers with location
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

  // DEBUG: Log drivers, customers, and rides
  console.log("filteredDrivers:", drivers);
  console.log("filteredCustomers:", customers);
  console.log("filteredRides:", rides);

  const filteredRides = rides.filter(
    (r) =>
      r.status &&
      !excludedStatuses.includes(r.status.toLowerCase())
  );

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
          {/* Driver markers */}
          {drivers.map(driver => (
            driver.lat && driver.lng ? (
              <Marker
                key={`driver-${driver.id}`}
                position={[driver.lat, driver.lng]}
                icon={driverIcon}
              >
                <Popup>
                  <b>Driver:</b> {driver.name || driver.phone || driver.id}
                  <br />
                  <b>Vehicle:</b> {driver.vehicleType || "Unknown"}
                  <br />
                  <b>Status:</b> Online
                </Popup>
              </Marker>
            ) : null
          ))}
          {/* Customer markers */}
          {customers.map(customer => (
            customer.lat && customer.lng ? (
              <Marker
                key={`customer-${customer.id}`}
                position={[customer.lat, customer.lng]}
                icon={customerIcon}
              >
                <Popup>
                  <b>Customer:</b> {customer.name || customer.phone || customer.id}
                  <br />
                  <b>Status:</b> Online
                </Popup>
              </Marker>
            ) : null
          ))}
          {/* Customer (ride origin) markers */}
          {filteredRides.map(ride => (
            ride.originLat && ride.originLng && (
              <Marker
                key={`ride-customer-${ride.id}`}
                position={[ride.originLat, ride.originLng]}
                icon={customerIcon}
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
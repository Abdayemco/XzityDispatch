import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerCustomer from "../assets/marker-customer.png";
import carIcon from "../assets/marker-car.png";
import bikeIcon from "../assets/marker-bike.png";
import tuktukIcon from "../assets/marker-toktok.png";
import truckIcon from "../assets/marker-truck.png";

function getVehicleIcon(vehicleType: string) {
  switch (vehicleType.toUpperCase()) {
    case "CAR": return carIcon;
    case "BIKE": return bikeIcon;
    case "TUKTUK":
    case "TOKTOK": return tuktukIcon;
    case "TRUCK": return truckIcon;
    default: return carIcon;
  }
}
function createLeafletIcon(url: string, w = 32, h = 41) {
  return L.icon({
    iconUrl: url,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h + 10],
    shadowUrl: undefined,
  });
}

type Job = {
  id: string;
  pickupLat: number;
  pickupLng: number;
  customerName?: string;
  vehicleType: string;
};

type AppMapProps = {
  jobs?: Job[];
  pickupLocation?: { lat: number; lng: number };
  userLocation?: { lat: number; lng: number };
  driverLocation?: { lat: number; lng: number };
  driverVehicleType?: string;
  showCustomerMarker?: boolean;
  showDriverMarker?: boolean;
};

const DEFAULT_CENTER: [number, number] = [51.505, -0.09];

const AppMap: React.FC<AppMapProps> = ({
  jobs = [],
  pickupLocation,
  userLocation,
  driverLocation,
  driverVehicleType = "car",
  showCustomerMarker = false,
  showDriverMarker = false,
}) => {
  // Compute center
  let center: [number, number] = DEFAULT_CENTER;
  if (pickupLocation) center = [pickupLocation.lat, pickupLocation.lng];
  else if (driverLocation) center = [driverLocation.lat, driverLocation.lng];
  else if (userLocation) center = [userLocation.lat, userLocation.lng];

  return (
    <div style={{ width: "100%", height: 340 }}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ width: "100%", height: "100%", borderRadius: 10 }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Driver marker */}
        {showDriverMarker && driverLocation && (
          <Marker
            position={[driverLocation.lat, driverLocation.lng]}
            icon={createLeafletIcon(getVehicleIcon(driverVehicleType), 40, 51)}
          >
            <Popup>Your location</Popup>
          </Marker>
        )}

        {/* Customer marker */}
        {showCustomerMarker && pickupLocation && (
          <Marker
            position={[pickupLocation.lat, pickupLocation.lng]}
            icon={createLeafletIcon(markerCustomer, 32, 41)}
          >
            <Popup>Your pickup location</Popup>
          </Marker>
        )}

        {/* Jobs for drivers */}
        {jobs.map(job => (
          <Marker
            key={job.id}
            position={[job.pickupLat, job.pickupLng]}
            icon={createLeafletIcon(getVehicleIcon(job.vehicleType), 32, 41)}
          >
            <Popup>
              {job.customerName
                ? `${job.customerName}'s Pickup`
                : "Pickup"}
              <br />
              Vehicle: {job.vehicleType}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default AppMap;
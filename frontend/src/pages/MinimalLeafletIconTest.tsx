import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import carIconUrl from "../assets/marker-car.png"; // Use your actual path

const driverIcon = L.icon({
  iconUrl: carIconUrl,
  iconSize: [40, 51],
  iconAnchor: [20, 51],
  popupAnchor: [0, -41],
});

export default function MinimalLeafletIconTest() {
  return (
    <div style={{ width: "100%", height: 500 }}>
      <MapContainer
        center={[30.0444, 31.2357]}
        zoom={13}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[30.0444, 31.2357]} icon={driverIcon}>
          <Popup>
            <b>Test Driver Marker</b>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
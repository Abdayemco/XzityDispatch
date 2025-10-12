import React from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";

interface AppMapProps {
  mapRole?: string;
  jobs?: any[];
  userLocation?: { lat: number; lng: number } | null;
  driverLocation?: { lat: number; lng: number };
  driverVehicleType?: string;
  showCustomerMarker?: boolean;
  showDriverMarker?: boolean;
  showCenterButton?: boolean;
  initialZoom?: number;
  routeCoords?: Array<[number, number]>;
}

export default function AppMap(props: AppMapProps) {
  const { userLocation, driverLocation } = props;

  // This is a stub component for the mobile app
  // In a real implementation, this would use react-native-maps or similar
  return (
    <View style={styles.mapContainer}>
      {userLocation ? (
        <View style={styles.mapPlaceholder}>
          <Text style={styles.mapText}>Map View</Text>
          <Text style={styles.mapCoords}>
            Your Location: {userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}
          </Text>
          {driverLocation && (
            <Text style={styles.mapCoords}>
              Driver Location: {driverLocation.lat.toFixed(4)}, {driverLocation.lng.toFixed(4)}
            </Text>
          )}
        </View>
      ) : (
        <View style={styles.mapPlaceholder}>
          <ActivityIndicator size="large" color="#1976D2" />
          <Text style={styles.mapText}>Loading map...</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    height: 220,
    backgroundColor: "#e8f4f8",
    borderRadius: 8,
    overflow: "hidden",
    marginHorizontal: 8,
    marginVertical: 8,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#e8f4f8",
  },
  mapText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1976D2",
    marginTop: 8,
  },
  mapCoords: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});

import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  KeyboardAvoidingView,
  FlatList,
  TextInput,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import * as Localization from "expo-localization";
import { DateTime } from "luxon";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { MaskedTextInput } from "react-native-mask-text";
import carIcon from "../assets/marker-car.png";
import deliveryIcon from "../assets/marker-delivery.png";
import tuktukIcon from "../assets/marker-tuktuk.png";
import limoIcon from "../assets/marker-limo.png";
import truckIcon from "../assets/marker-truck.png";
import waterTruckIcon from "../assets/marker-watertruck.png";
import towTruckIcon from "../assets/marker-towtruck.png";
import wheelchairIcon from "../assets/marker-wheelchair.png";
import cleaningIcon from "../assets/marker-cleaning.png";
import shoppingIcon from "../assets/marker-shopping.png";
import beautyIcon from "../assets/marker-institute.png";
import hairIcon from "../assets/marker-hair.png";
import AppHeader from "../components/AppHeader";
import AppFooter from "../components/AppFooter";
import AppMap from "../components/AppMap";
import ScheduleServiceModal from "../components/ScheduleServiceModal";
import { useNavigation } from "@react-navigation/native";

const API_URL = "https://xzitydispatch-b.onrender.com";
dayjs.extend(customParseFormat);

const MAPBOX_TOKEN = "pk.eyJ1IjoiYWJkYXllbSIsImEiOiJjbWU4cWpkeTkwaW94MmtyM3Z0dzh0dHowIn0.sPuKxhGyHM8kD8hs65uHyA";

const vehicleOptions = [
  { value: "CAR", label: "Car", icon: carIcon },
  { value: "DELIVERY", label: "Delivery", icon: deliveryIcon },
  { value: "TUKTUK", label: "Tuktuk", icon: tuktukIcon },
  { value: "LIMO", label: "Limo", icon: limoIcon },
  { value: "TRUCK", label: "Truck", icon: truckIcon },
  { value: "WATER_TRUCK", label: "Water", icon: waterTruckIcon },
  { value: "TOW_TRUCK", label: "Towing", icon: towTruckIcon },
  { value: "WHEELCHAIR", label: "Wheelchair", icon: wheelchairIcon },
  { value: "CLEANING", label: "Cleaning", icon: cleaningIcon },
  { value: "SHOPPING", label: "Shopping", icon: shoppingIcon },
  { value: "BEAUTY", label: "Beauty", icon: beautyIcon },
  { value: "HAIR_DRESSER", label: "Hair Dresser", icon: hairIcon },
];

function isVehicle(type: string) {
  return [
    "CAR",
    "DELIVERY",
    "TUKTUK",
    "LIMO",
    "TRUCK",
    "WATER_TRUCK",
    "TOW_TRUCK",
    "WHEELCHAIR",
  ].includes(type);
}

function getCustomerIdFromStorage(): Promise<number | null> {
  return AsyncStorage.getItem("userId").then(raw => {
    if (!raw) return null;
    const parsed = Number(raw);
    return !isNaN(parsed) && Number.isInteger(parsed) ? parsed : null;
  });
}

type RideStatus = "requested" | "pending" | "accepted" | "in_progress" | "done" | "cancelled" | "scheduled" | null;
type DriverInfo = {
  name?: string;
  vehicleType?: string;
  lastKnownLat?: number | null;
  lastKnownLng?: number | null;
};
type RideListItem = {
  id: number;
  vehicleType: string;
  status: RideStatus;
  destinationName?: string;
  scheduledAt?: string;
  note?: string;
  driver?: DriverInfo;
  originLat?: number;
  originLng?: number;
  requestedAtTime?: string;
  etaKm?: number | null;
  etaMin?: number | null;
  description?: string;
  imageUri?: string;
  subType?: string;
};

type ChatMessage = {
  id: string | number;
  sender?: { name?: string; role?: "customer" | "driver" | string; id?: number };
  content: string;
  timestamp?: string;
};

function StarRating({
  rating,
  setRating,
  disabled = false,
  size = 30,
}: {
  rating: number;
  setRating: (value: number) => void;
  disabled?: boolean;
  size?: number;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", marginVertical: 8 }}>
      {[1, 2, 3, 4, 5].map(star => (
        <TouchableOpacity
          key={star}
          onPress={() => !disabled && setRating(star)}
          disabled={disabled}
        >
          <Text style={{
            fontSize: size,
            color: star <= rating ? "#FFD700" : "#bbb",
            marginHorizontal: 2,
          }}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RideChatInline({ rideId, visible, customerName }: { rideId: number; visible: boolean; customerName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);

  useEffect(() => {
    getCustomerIdFromStorage().then(setCustomerId);
  }, []);

  useEffect(() => {
    if (!visible || !rideId) return;
    let interval: any;
    const fetchMessages = async () => {
      const token = await AsyncStorage.getItem("token");
      try {
        const res = await fetch(`${API_URL}/api/rides/${rideId}/chat/messages`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) setMessages(await res.json());
      } catch { }
    };
    fetchMessages();
    interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [rideId, visible]);

  useEffect(() => {
    if (scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setSending(true);
    const token = await AsyncStorage.getItem("token");
    try {
      await fetch(`${API_URL}/api/rides/${rideId}/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify({
          content: input,
          sender: {
            id: customerId,
            name: customerName,
            role: "customer",
            avatar: ""
          }
        }),
      });
      setInput("");
    } catch { }
    setSending(false);
  };

  if (!visible) return null;
  return (
    <View style={styles.chatContainer}>
      <Text style={{ fontWeight: "bold", color: "#1976d2", marginBottom: 4, textAlign: "center" }}>Chat</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.chatMessages}
        contentContainerStyle={{ paddingBottom: 4, paddingTop: 2 }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="always"
      >
        {messages.map((msg, i) => {
          let isCustomer = false;
          if (msg.sender) {
            if (typeof customerId === "number" && msg.sender.id === customerId) {
              isCustomer = true;
            } else if (msg.sender.role === "customer") {
              isCustomer = true;
            }
          }
          const senderName = (msg.sender && msg.sender.name) || (isCustomer ? customerName : "Driver");
          const alignSelf = isCustomer ? "flex-end" : "flex-start";
          const bubbleColor = isCustomer ? "#e6f0ff" : "#f1f1f1";
          return (
            <View key={i} style={{
              alignSelf,
              backgroundColor: bubbleColor,
              padding: 5,
              borderRadius: 6,
              marginVertical: 1,
              maxWidth: "95%",
              flexDirection: "row",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}>
              <Text style={{
                fontWeight: "bold",
                fontSize: 12,
                marginRight: 7,
                color: "#1976d2",
                lineHeight: 18,
              }}>{senderName}:</Text>
              <Text style={{
                fontSize: 14,
                flexShrink: 1,
                flexWrap: "wrap",
                lineHeight: 18,
              }}>{msg.content}</Text>
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          value={input}
          onChangeText={setInput}
          placeholder="Type..."
          editable={!sending}
          multiline={true}
          numberOfLines={1}
          maxLength={500}
          scrollEnabled={true}
          onSubmitEditing={({ nativeEvent }) => {
            if (input.trim()) sendMessage();
          }}
          returnKeyType="send"
          blurOnSubmit={true}
        />
        <TouchableOpacity onPress={sendMessage} disabled={sending || !input.trim()} style={styles.chatSendBtn}>
          <Text style={{ color: "#fff" }}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function getDateTimeMaskForLocale(locale: string): string {
  if (locale.startsWith("en-US")) return "99/99/9999 99:99";
  if (locale.startsWith("en-GB") || locale.startsWith("fr") || locale.startsWith("de")) return "99/99/9999 99:99";
  return "9999-99-99 99:99";
}
function getDateTimeFormatForLocale(locale: string): string {
  if (locale.startsWith("en-US")) return "MM/DD/YYYY HH:mm";
  if (locale.startsWith("en-GB") || locale.startsWith("fr") || locale.startsWith("de")) return "DD/MM/YYYY HH:mm";
  return "YYYY-MM-DD HH:mm";
}

async function getMapboxRoute(driverLocation, customerLocation, mapboxToken) {
  if (!driverLocation || !customerLocation || !mapboxToken) return null;
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${driverLocation.lng},${driverLocation.lat};${customerLocation.lng},${customerLocation.lat}?geometries=geojson&access_token=${mapboxToken}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      return data.routes[0].geometry.coordinates;
    }
    return null;
  } catch {
    return null;
  }
}

export default function CustomerDashboardScreen() {
  const [token, setToken] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [customerName, setCustomerName] = useState<string>("You");
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedType, setSelectedType] = useState<string>(""); // vehicle/service type user picked
  const [actionModalVisible, setActionModalVisible] = useState(false); // for vehicle actions
  const [serviceModalVisible, setServiceModalVisible] = useState(false); // for services
  const [vehicleScheduleModalVisible, setVehicleScheduleModalVisible] = useState(false); // for vehicle schedule

  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rideList, setRideList] = useState<RideListItem[]>([]);
  const [rideListLoading, setRideListLoading] = useState(false);

  const [dateTimeString, setDateTimeString] = useState("");
  const [isDateTimeValid, setIsDateTimeValid] = useState(false);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [scheduleNote, setScheduleNote] = useState<string>("");
  const [scheduleWaiting, setScheduleWaiting] = useState(false);
  const [userLocale, setUserLocale] = useState<string>(Localization.getLocales()[0]?.languageTag || "en-US");

  const [schedEditMode, setSchedEditMode] = useState(false);
  const [schedRideId, setSchedRideId] = useState<number | null>(null);

  // Rating/Chat states, routeCoords, etc. unchanged...
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingRideId, setRatingRideId] = useState<number | null>(null);
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingFeedback, setRatingFeedback] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);

  const [pollRidesFlag, setPollRidesFlag] = useState(0);
  const [openChatRideId, setOpenChatRideId] = useState<number | null>(null);

  const [routeCoords, setRouteCoords] = useState<Array<[number, number]>>([]);

  const navigation = useNavigation();

  useEffect(() => {
    getCustomerIdFromStorage().then(setCustomerId);
  }, []);

  useEffect(() => {
    if (Localization.getLocales && Localization.getLocales().length) {
      setUserLocale(Localization.getLocales()[0].languageTag);
    }
  }, []);

  const dateTimeMask = getDateTimeMaskForLocale(userLocale);
  const dateTimeFormat = getDateTimeFormatForLocale(userLocale);

  useEffect(() => {
    if (!dateTimeString) {
      setIsDateTimeValid(false);
      setScheduleDate(null);
      return;
    }
    const parsed = dayjs(dateTimeString, dateTimeFormat, true);
    setIsDateTimeValid(parsed.isValid());
    setScheduleDate(parsed.isValid() ? parsed.toDate() : null);
  }, [dateTimeString, dateTimeFormat]);

  useEffect(() => {
    AsyncStorage.getItem("token").then(setToken);
    AsyncStorage.getItem("user").then(u => {
      if (u) {
        try {
          setCustomerName(JSON.parse(u).name || "You");
        } catch { setCustomerName("You"); }
      }
    });
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError("Location permission denied.");
        return;
      }
      try {
        let loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch (e) {
        setError("Failed to fetch location.");
      }
    })();
  }, []);

  const fetchRides = useCallback(async () => {
    const customerId = await getCustomerIdFromStorage();
    if (!customerId) return;
    setRideListLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/rides/all?customerId=${customerId}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) {
        const rides = await res.json();
        const allowed = ["requested", "pending", "accepted", "in_progress", "scheduled"];
        const filteredRides = rides.filter(r =>
          allowed.includes((r.status || "").toLowerCase())
        );
        setRideList(filteredRides);

        const activeRide = filteredRides.find(r =>
          ["accepted", "in_progress"].includes((r.status ?? "").toLowerCase())
        );
        setOpenChatRideId(activeRide ? activeRide.id : null);
      }
    } catch { }
    setRideListLoading(false);
  }, [token]);

  useEffect(() => { fetchRides(); }, [fetchRides]);
  useEffect(() => {
    const interval = setInterval(() => {
      setPollRidesFlag(f => f + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => { fetchRides(); }, [pollRidesFlag, fetchRides]);
  useEffect(() => {
    const activeRide = rideList.find(
      r => ["accepted", "in_progress"].includes((r.status ?? "").toLowerCase())
    );
    if (activeRide && openChatRideId !== activeRide.id) {
      setOpenChatRideId(activeRide.id);
    }
    if (!activeRide && openChatRideId !== null) {
      setOpenChatRideId(null);
    }
  }, [rideList, openChatRideId]);
  useEffect(() => {
    let isActive = true;
    async function fetchRoute() {
      const activeRide = rideList.find(
        r => ["accepted", "in_progress"].includes((r.status ?? "").toLowerCase())
      );
      if (
        activeRide &&
        activeRide.driver &&
        activeRide.driver.lastKnownLat != null &&
        activeRide.driver.lastKnownLng != null &&
        userLocation &&
        MAPBOX_TOKEN
      ) {
        const coords = await getMapboxRoute(
          { lat: activeRide.driver.lastKnownLat, lng: activeRide.driver.lastKnownLng },
          userLocation,
          MAPBOX_TOKEN
        );
        if (isActive && coords) setRouteCoords(coords);
      } else {
        setRouteCoords([]);
      }
    }
    fetchRoute();
    return () => { isActive = false; };
  }, [rideList, userLocation]);

  // Core: when user selects a vehicle/service
  function onOptionPress(type: string) {
    setSelectedType(type);
    if (isVehicle(type)) {
      setActionModalVisible(true);
    } else {
      setServiceModalVisible(true);
    }
  }

  // Vehicle: request now
  async function handleVehicleRequestNow() {
    setActionModalVisible(false);
    if (!userLocation || !selectedType) return;
    const token = await AsyncStorage.getItem("token");
    const customerId = await getCustomerIdFromStorage();
    if (!token || customerId === null) return;
    setWaiting(true);
    setError(null);
    const payload: any = {
      customerId,
      originLat: userLocation.lat,
      originLng: userLocation.lng,
      destLat: userLocation.lat,
      destLng: userLocation.lng,
      vehicleType: selectedType,
    };
    try {
      await fetch(`${API_URL}/api/rides/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      fetchRides();
    } catch (err) {}
    setWaiting(false);
  }

  // Vehicle: schedule
  function handleVehicleSchedule() {
    setActionModalVisible(false);
    setSchedEditMode(false);
    setSchedRideId(null);
    setDateTimeString("");
    setScheduleNote("");
    setVehicleScheduleModalVisible(true);
  }

  async function handleScheduleRide() {
    if (!userLocation || !selectedType || !isDateTimeValid || !scheduleDate) {
      setError("All fields are required & must be valid.");
      return;
    }
    setScheduleWaiting(true);
    setError(null);
    const token = await AsyncStorage.getItem("token");
    const customerId = await getCustomerIdFromStorage();
    if (!token || customerId === null) {
      setError("Not logged in.");
      setScheduleWaiting(false);
      return;
    }
    try {
      let res, data;
      res = await fetch(`${API_URL}/api/rides/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          customerId,
          originLat: userLocation.lat,
          originLng: userLocation.lng,
          destLat: userLocation.lat,
          destLng: userLocation.lng,
          vehicleType: selectedType,
          scheduledAt: DateTime.fromJSDate(scheduleDate).toISO(),
          note: scheduleNote,
        }),
      });
      data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to schedule ride.");
        setScheduleWaiting(false);
        return;
      }
      setVehicleScheduleModalVisible(false);
      setScheduleNote("");
      setScheduleDate(null);
      setDateTimeString("");
      setSchedEditMode(false);
      setSchedRideId(null);
      fetchRides();
      setError(null);
    } catch (err) {
      setError("Network or server error.");
    } finally {
      setScheduleWaiting(false);
    }
  }


  async function handleCancelRide(rideId: number) {
    setWaiting(true);
    setError(null);
    const token = await AsyncStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/cancel`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to cancel ride.");
        setWaiting(false);
        return;
      }
      fetchRides();
    } catch (err) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  async function handleDoneRide(rideId: number) {
    setWaiting(true);
    setError(null);
    const token = await AsyncStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/done`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to mark ride as done.");
        setWaiting(false);
        return;
      }
      fetchRides();
      setRatingRideId(rideId);
      setRatingValue(5);
      setRatingFeedback("");
      setShowRatingModal(true);
    } catch (err) {
      setError("Network or server error.");
    } finally {
      setWaiting(false);
    }
  }

  async function handleSubmitRating() {
    if (!ratingRideId || !ratingValue) return;
    setSubmittingRating(true);
    const token = await AsyncStorage.getItem("token");
    try {
      const res = await fetch(`${API_URL}/api/rides/${ratingRideId}/rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: token ? `Bearer ${token}` : "" },
        body: JSON.stringify({
          rating: ratingValue,
          feedback: ratingFeedback,
        }),
      });
      const data = await res.json();
      setShowRatingModal(false);
      setRatingRideId(null);
      fetchRides();
    } catch (err) {
      setShowRatingModal(false);
      setRatingRideId(null);
    } finally {
      setSubmittingRating(false);
    }
  }

  // --- MAP  MARKERS  LOGIC ---
 // --- MAP MARKERS LOGIC ---
 const mostActiveRide = rideList.find(r =>
    ["accepted", "in_progress"].includes((r.status ?? "").toLowerCase())
  );
  const driverLocationForMap = (mostActiveRide && mostActiveRide.driver && mostActiveRide.driver.lastKnownLat && mostActiveRide.driver.lastKnownLng)
    ? {
        lat: mostActiveRide.driver.lastKnownLat,
        lng: mostActiveRide.driver.lastKnownLng
      }
    : undefined;
  const driverVehicleTypeForMap = mostActiveRide?.driver?.vehicleType || "car";
  const mapJobs = [];

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <AppHeader />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ListHeaderComponent={
            <>
              {error && <Text style={styles.error}>{error}</Text>}
              {!userLocation ? (
                <View style={{ height: 220, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator size="large" color="#1976D2" />
                  <Text style={{ marginTop: 10, color: "#888" }}>Getting your location...</Text>
                </View>
              ) : (
                <AppMap
                  mapRole="customer"
                  jobs={mapJobs}
                  userLocation={userLocation}
                  driverLocation={driverLocationForMap}
                  driverVehicleType={driverVehicleTypeForMap}
                  showCustomerMarker={!!userLocation}
                  showDriverMarker={!!driverLocationForMap}
                  showCenterButton={true}
                  initialZoom={15}
                  routeCoords={routeCoords && routeCoords.length > 1 ? routeCoords : undefined}
                />
              )}
              <Text style={styles.subHeader}>Request a Service below:</Text>
              <View style={styles.vehicleOptions}>
                {vehicleOptions.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={styles.vehicleButton}
                    onPress={() => onOptionPress(opt.value)}
                  >
                    <Image source={opt.icon} style={{ width: 32, height: 32 }} />
                    <Text style={{ fontWeight: "bold", marginTop: 2 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.sectionHeader}>See your Requests to edit & cancel</Text>
              {rideListLoading && <ActivityIndicator size="small" color="#1976D2" />}
              {rideList.length === 0 && !rideListLoading && (
                <Text style={styles.noRides}>No requests yet.</Text>
              )}
            </>
          }
          data={
            rideList
              .filter(r => ["requested", "pending", "accepted", "in_progress", "scheduled"].includes((r.status ?? "").toLowerCase()))
              .sort((a, b) => {
                const order = (s: RideStatus) => ({
                  in_progress: 0,
                  accepted: 1,
                  pending: 2,
                  requested: 3,
                  scheduled: 4,
                  null: 99,
                })[s ?? "null"] ?? 99;
                const cmp = order((a.status ?? "").toLowerCase()) - order((b.status ?? "").toLowerCase());
                if (cmp !== 0) return cmp;
                if (a.scheduledAt && b.scheduledAt)
                  return DateTime.fromISO(a.scheduledAt).toMillis() - DateTime.fromISO(b.scheduledAt).toMillis();
                return b.id - a.id;
              })
          }
          keyExtractor={r => String(r.id)}
          renderItem={({ item: ride }) => {
            const status = (ride.status ?? "").toLowerCase();
            const showChat = (["accepted", "in_progress"].includes(status) && openChatRideId === ride.id);
            const canCancel = ["requested", "pending", "accepted", "scheduled"].includes(status);
            const canEditScheduled = status === "scheduled";
            const showDoneBtn = status === "in_progress";
            const icon = vehicleOptions.find(opt => opt.value === ride.vehicleType)?.icon || carIcon;
            return (
              <View style={styles.rideCard}>
                <View style={{flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", marginBottom: 2}}>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Image source={icon} style={{ width: 32, height: 32, marginRight: 7 }} />
                    <Text style={{ fontWeight: "bold" }}>{ride.vehicleType}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                    {canCancel && (
                      <TouchableOpacity
                        style={styles.cancelBtn}
                        onPress={() => handleCancelRide(ride.id)}
                      >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    {canEditScheduled && (
                      <TouchableOpacity
                        style={[styles.scheduleBtn, { backgroundColor: "#1976D2", height: 25, minWidth: 70, paddingVertical: 3 }]}
                        onPress={() => openScheduleEdit(ride)}
                      >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>Edit</Text>
                      </TouchableOpacity>
                    )}
                    {showDoneBtn && (
                      <TouchableOpacity
                        style={styles.doneBtn}
                        onPress={() => handleDoneRide(ride.id)}
                      >
                        <Text style={{ color: "#fff", fontWeight: "bold" }}>Done</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                {/* EXPLICIT service rendering */}
                {ride.vehicleType === "CLEANING" && ride.description && (
                  <Text style={{ color: "#1976D2" }}>
                    To Clean: {ride.description}
                  </Text>
                )}
                {ride.vehicleType === "SHOPPING" && ride.description && (
                  <Text style={{ color: "#1976D2" }}>
                    To Shop: {ride.description}
                  </Text>
                )}
                {ride.vehicleType === "BEAUTY" && (
                  <Text style={{ color: "#1976D2" }}>
                    Beauty: {ride.subType ? ride.subType + " - " : ""}
                {ride.description ? ride.description : ""}
                 </Text>
               )}
               {ride.vehicleType === "HAIR_DRESSER" && (
                 <Text style={{ color: "#1976D2" }}>
                   Hair: {ride.subType ? ride.subType : ""}{ride.description ? ` - ${ride.description}` : ""}
                 </Text>
                )}
                {ride.vehicleType === "SHOPPING" && ride.imageUri && (
                  <Image source={{ uri: ride.imageUri }} style={{ width: 44, height: 44, borderRadius: 7, marginVertical: 5 }} />
                )}
                {ride.destinationName && <Text>Destination: {ride.destinationName}</Text>}
                {ride.scheduledAt && (
                  <Text style={{ fontSize: 13, color: "#555" }}>
                    Scheduled: {DateTime.fromISO(ride.scheduledAt).toFormat("yyyy-MM-dd HH:mm")}
                  </Text>
                )}
                {ride.note && <Text style={{ color: "#888", fontSize: 13 }}>Note: {ride.note}</Text>}
                {ride.requestedAtTime && (
                  <Text style={{ color: "#1976D2", fontSize: 14 }}>
                    Requested: {ride.requestedAtTime}
                  </Text>
                )}
                {ride.etaMin != null && ride.etaKm != null && (
                  <Text style={{ color: "#388e3c", fontWeight: "bold" }}>
                    ETA: {ride.etaMin} min ({ride.etaKm} km)
                  </Text>
                )}
                {ride.driver?.name && (
                  <Text style={{ color: "#1976D2", fontSize: 14 }}>
                    Driver: {ride.driver.name}
                  </Text>
                )}
                {showChat && (
                  <RideChatInline
                    rideId={ride.id}
                    visible={true}
                    customerName={customerName}
                  />
                )}
              </View>
            );
          }}
          ListFooterComponent={<View style={{ height: 60 }} />}
        />

        {/* --- Modal for vehicles: Request Now/Schedule --- */}
        <Modal
          visible={actionModalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setActionModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.actionModal}>
              <Text style={styles.header}>What do you want to do?</Text>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleVehicleRequestNow}
              >
                <Text style={styles.confirmText}>Request Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scheduleBtn}
                onPress={handleVehicleSchedule}
              >
                <Text style={styles.confirmText}>Schedule</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setActionModalVisible(false)}
              >
                <Text style={styles.confirmText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* --- Service Modal for Cleaning/Shopping/Beauty/Hair --- */}
        <ScheduleServiceModal
          visible={serviceModalVisible}
          serviceType={selectedType as "CLEANING" | "SHOPPING" | "BEAUTY" | "HAIR_DRESSER"}
          onClose={() => setServiceModalVisible(false)}
          customerId={customerId}
          userLocation={userLocation}
          token={token}
        />

        {/* --- Vehicle Scheduling Modal --- */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={vehicleScheduleModalVisible}
          onRequestClose={() => setVehicleScheduleModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <Text style={{ fontWeight: "bold", fontSize: 18, marginBottom: 12 }}>
                Schedule a Request
              </Text>
              <Text style={{ fontSize: 15, marginBottom: 6 }}>Date & Time MM/DD/YYYY HH:MM</Text>
              <MaskedTextInput
                mask={dateTimeMask}
                style={styles.input}
                value={dateTimeString}
                onChangeText={setDateTimeString}
                placeholder={dateTimeFormat}
                keyboardType="numbers-and-punctuation"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!isDateTimeValid && !!dateTimeString && (
                <Text style={{ color: "#d32f2f", textAlign: "center", marginBottom: 6 }}>
                  Enter a valid date & time
                </Text>
              )}
              <Text style={{ fontSize: 15, marginBottom: 4, marginTop: 10 }}>Note (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Message to provider"
                value={scheduleNote}
                onChangeText={setScheduleNote}
              />
              <View style={styles.scheduleActionRow}>
                <TouchableOpacity
                  style={[styles.scheduleBtn, { flex: 1, marginRight: 5 }, !isDateTimeValid && { opacity: 0.5 }]}
                  onPress={handleScheduleRide}
                  disabled={scheduleWaiting || !isDateTimeValid}
                >
                  <Text style={styles.requestBtnText}>
                    {scheduleWaiting ? "Scheduling..." : "Confirm"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelBtn, styles.cancelBtnModal, { flex: 1, marginLeft: 5 }]}
                  onPress={() => {
                    setVehicleScheduleModalVisible(false);
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "bold" }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* (Rating modal, etc. unchanged) */}
        <AppFooter />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: "#d32f2f", textAlign: "center", marginVertical: 6 },
  subHeader: { textAlign: "center", fontWeight: "bold", marginTop: 8, marginBottom: 4 },
  vehicleOptions: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 10 },
  vehicleButton: { alignItems: "center", borderWidth: 2, borderColor: "#ccc", borderRadius: 8, padding: 10, margin: 2, backgroundColor: "#fff" },
  vehicleButtonSelected: { borderColor: "#1976D2", backgroundColor: "#e6f0ff" },
  sectionHeader: { fontSize: 15, fontWeight: "bold", textAlign: "center", marginTop: 12 },
  rideCard: { backgroundColor: "#f8f8ff", borderWidth: 1, borderColor: "#eee", borderRadius: 10, marginVertical: 7, padding: 11, shadowColor: "#eee", shadowOpacity: 0.5 },
  cancelBtn: { backgroundColor: "#d32f2f", borderRadius: 7, paddingVertical: 3, paddingHorizontal: 16, alignItems: "center", marginHorizontal: 2, minWidth: 70, height: 25, justifyContent: "center" },
  cancelBtnModal: { paddingVertical: 0, paddingHorizontal: 0 },
  doneBtn: { backgroundColor: "#388e3c", borderRadius: 7, paddingVertical: 3, paddingHorizontal: 16, alignItems: "center", marginHorizontal: 2, minWidth: 70, height: 25, justifyContent: "center" },
  noRides: { color: "#888", marginBottom: 10, textAlign: "center", fontSize: 13 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  actionModal: { backgroundColor: "#fff", borderRadius: 14, padding: 24, width: "80%", shadowColor: "#000", shadowOpacity: 0.13, shadowRadius: 12, elevation: 7, alignItems: "center" },
  modalContent: { backgroundColor: "#fff", borderRadius: 14, padding: 16, width: "90%", shadowColor: "#000", shadowOpacity: 0.17, shadowRadius: 12, elevation: 8 },
  header: { fontWeight: "bold", fontSize: 20, marginBottom: 12, textAlign: "center" },
  confirmBtn: { backgroundColor: "#1976D2", borderRadius: 7, paddingVertical: 10, paddingHorizontal: 28, alignItems: "center", minWidth: 160, marginVertical: 7 },
  scheduleBtn: { backgroundColor: "#388e3c", borderRadius: 7, paddingVertical: 10, paddingHorizontal: 28, alignItems: "center", minWidth: 160, marginVertical: 7 },
  confirmText: { color: "#fff", fontWeight: "bold", fontSize: 16, textAlign: "center" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 9, marginBottom: 6, fontSize: 14, backgroundColor: "#f8f8f8", alignSelf: "stretch" },
  scheduleActionRow: { flexDirection: "row", marginTop: 13, justifyContent: "space-between", alignItems: "center" },
  chatContainer: {
    backgroundColor: "#f4f8ff",
    borderRadius: 10,
    padding: 7,
    marginTop: 7,
    borderWidth: 1,
    borderColor: "#e6e8ee",
    minWidth: 180,
    maxWidth: 360,
    minHeight: 120,
    maxHeight: 180,
    alignSelf: "stretch",
    flex: 1,
  },
  chatMessages: {
    flexGrow: 1,
    minHeight: 75,
    maxHeight: 90,
  },
  chatInputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 6,
    backgroundColor: "#fafafa",
    marginRight: 7,
    minHeight: 36,
    maxHeight: 56,
    fontSize: 15,
    textAlignVertical: "top",
  },
  chatSendBtn: {
    backgroundColor: "#1976D2",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 13,
    minHeight: 32,
    minWidth: 44,
    alignItems: "center",
    justifyContent: "center",
  },
});
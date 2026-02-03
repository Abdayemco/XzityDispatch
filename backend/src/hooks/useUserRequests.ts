import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Update with your backend API URL
const API_URL = "https://xzitydispatch-b.onrender.com";

export type UserRequest = {
  id: number;
  scheduledAt?: string | null;
  scheduledAtDisplay?: string | null;
  requestedAt?: string | null;
  requestedAtTime?: string | null;
  vehicleType?: string | null;
  categoryName?: string | null;
  destinationName?: string | null;
  note?: string | null;
  status: string;
  acceptedAt?: string | null;
  driver?: any;
  etaMin?: number | null;
  etaKm?: number | null;
  rated?: boolean;
  subType?: string | null;
  imageUri?: string | null;
};

export function useUserRequests(pollingIntervalMs: number = 10000) {
  const [requests, setRequests] = useState<UserRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get the user ID from async storage (always returns a number or null)
  const fetchUserId = useCallback(async (): Promise<number | null> => {
    const raw = await AsyncStorage.getItem("userId");
    if (!raw) return null;
    const id = Number(raw);
    return (!isNaN(id) && Number.isInteger(id)) ? id : null;
  }, []);

  // Fetch the user's requests list from backend
  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const customerId = await fetchUserId();
      const token = await AsyncStorage.getItem("token");
      if (customerId === null || typeof customerId !== "number" || isNaN(customerId)) {
        throw new Error("No valid customer ID");
      }
      const res = await fetch(`${API_URL}/api/rides/all?customerId=${customerId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      Array.isArray(data) ? setRequests(data) : setRequests([]);
    } catch (err: any) {
      setError(typeof err === "string" ? err : err?.message ?? "Unknown error");
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [fetchUserId]);

  // Initial fetch and polling
  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, pollingIntervalMs);
    return () => clearInterval(interval);
  }, [fetchRequests, pollingIntervalMs]);

  return { requests, loading, error, refetch: fetchRequests };
}
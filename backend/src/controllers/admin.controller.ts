// PART 1: Imports, helpers, user endpoints, and scheduled ride utilities

import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { RideStatus } from "@prisma/client";
import { utcToLocal } from "../utils/timezone";  // <-- Import the utility

// Helper to get safe sort params
function getSortParams(query: any, allowedFields: string[], defaultField = "id", defaultOrder = "desc") {
  const sortBy = allowedFields.includes(query.sortBy) ? query.sortBy : defaultField;
  const order = (query.order === "asc" || query.order === "desc") ? query.order : defaultOrder;
  return { sortBy, order };
}

// Helper for pagination
function getPagination(query: any, defaultLimit = 50) {
  const limit = Math.max(1, Math.min(100, Number(query.limit) || defaultLimit));
  const offset = Math.max(0, Number(query.offset) || 0);
  return { take: limit, skip: offset };
}

// Helper for location radius filtering (Haversine formula)
function locationRadiusFilter(query: any) {
  const lat = query.lat ? Number(query.lat) : undefined;
  const lng = query.lng ? Number(query.lng) : undefined;
  const radiusKm = query.radiusKm ? Number(query.radiusKm) : undefined;
  if (!lat || !lng || !radiusKm) return undefined;
  const deltaLat = radiusKm / 111;
  const deltaLng = radiusKm / (111 * Math.cos(lat * Math.PI / 180));
  return {
    lat: { gte: lat - deltaLat, lte: lat + deltaLat },
    lng: { gte: lng - deltaLng, lte: lng + deltaLng },
  };
}

// --- Helper: Get timezone from lat/lng using TimeZoneDB (needs apiKey configured) ---
async function getTimeZoneFromCoords(lat: number, lng: number): Promise<string> {
  const apiKey = process.env.TIMEZONEDB_API_KEY || "YOUR_TIMEZONEDB_API_KEY";
  try {
    const res = await fetch(
      `https://api.timezonedb.com/v2.1/get-time-zone?key=${apiKey}&format=json&by=position&lat=${lat}&lng=${lng}`
    );
    const data = await res.json();
    if (data.zoneName) return data.zoneName;
  } catch {}
  return "UTC";
}

// --- Drivers endpoint ---
export const getDrivers = async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      "id", "name", "phone", "email", "avatar", "vehicleType",
      "trialStart", "trialEnd", "subscriptionStatus", "subscriptionFee",
      "paymentMethod", "isSubscriptionDisabled", "disabled", "online",
      "lat", "lng", "country", "area"
    ];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const { take, skip } = getPagination(req.query);

    const where: any = { role: "DRIVER" };
    if (req.query.online !== undefined) where.online = req.query.online === "true";
    if (req.query.disabled !== undefined) where.disabled = req.query.disabled === "true";
    if (req.query.vehicleType) where.vehicleType = req.query.vehicleType;
    if (req.query.subscriptionStatus) where.subscriptionStatus = req.query.subscriptionStatus;
    if (req.query.lat) where.lat = Number(req.query.lat);
    if (req.query.lng) where.lng = Number(req.query.lng);
    if (req.query.country) where.country = req.query.country;
    if (req.query.area) where.area = req.query.area;
    Object.assign(where, locationRadiusFilter(req.query));

    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    const drivers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        vehicleType: true,
        lat: true,
        lng: true,
        online: true,
        trialStart: true,
        trialEnd: true,
        subscriptionStatus: true,
        subscriptionFee: true,
        paymentMethod: true,
        isSubscriptionDisabled: true,
        disabled: true,
        country: true,
        area: true,
      },
      orderBy: { [sortBy]: order },
      skip,
      take
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch drivers" });
  }
};

// --- Enable/Disable Driver endpoints ---
export const disableDriver = async (req: Request, res: Response) => {
  try {
    const driverId = Number(req.params.id);
    const driver = await prisma.user.update({
      where: { id: driverId, role: "DRIVER" },
      data: { disabled: true },
      select: { id: true, name: true, disabled: true }
    });
    res.json(driver);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.status(500).json({ error: "Failed to disable driver" });
  }
};
export const enableDriver = async (req: Request, res: Response) => {
  try {
    const driverId = Number(req.params.id);
    const driver = await prisma.user.update({
      where: { id: driverId, role: "DRIVER" },
      data: { disabled: false },
      select: { id: true, name: true, disabled: true }
    });
    res.json(driver);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Driver not found" });
    }
    res.status(500).json({ error: "Failed to enable driver" });
  }
};

// --- MAP DRIVERS endpoint for admin live map ---
export const getMapDrivers = async (req: Request, res: Response) => {
  try {
    const drivers = await prisma.user.findMany({
      where: {
        role: "DRIVER",
        online: true,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        lat: true,
        lng: true,
        online: true,
      },
    });
    res.json(drivers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch map drivers" });
  }
};

// --- Customers endpoint ---
export const getCustomers = async (req: Request, res: Response) => {
  try {
    const allowedFields = [
      "id", "name", "phone", "email", "avatar", "disabled", "online", "lat", "lng", "country", "area"
    ];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "id", "desc");
    const { take, skip } = getPagination(req.query);

    const where: any = { role: "CUSTOMER" };
    if (req.query.online !== undefined) where.online = req.query.online === "true";
    if (req.query.disabled !== undefined) where.disabled = req.query.disabled === "true";
    if (req.query.lat) where.lat = Number(req.query.lat);
    if (req.query.lng) where.lng = Number(req.query.lng);
    if (req.query.country) where.country = req.query.country;
    if (req.query.area) where.area = req.query.area;
    Object.assign(where, locationRadiusFilter(req.query));

    if (req.query.search) {
      const search = String(req.query.search);
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } }
      ];
    }

    const customers = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        lat: true,
        lng: true,
        online: true,
        disabled: true,
        country: true,
        area: true,
      },
      orderBy: { [sortBy]: order },
      skip,
      take
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

// --- Enable/Disable Customer endpoints ---
// (unchanged below)

export const disableCustomer = async (req: Request, res: Response) => {
  try {
    const customerId = Number(req.params.id);
    const customer = await prisma.user.update({
      where: { id: customerId, role: "CUSTOMER" },
      data: { disabled: true },
      select: { id: true, name: true, disabled: true }
    });
    res.json(customer);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(500).json({ error: "Failed to disable customer" });
  }
};
export const enableCustomer = async (req: Request, res: Response) => {
  try {
    const customerId = Number(req.params.id);
    const customer = await prisma.user.update({
      where: { id: customerId, role: "CUSTOMER" },
      data: { disabled: false },
      select: { id: true, name: true, disabled: true }
    });
    res.json(customer);
  } catch (error: any) {
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.status(500).json({ error: "Failed to enable customer" });
  }
};
// PART 2: Rides endpoints with scheduledAt converted to pickup location time zone

import fetch from "node-fetch"; // Needed for timezone API calls (if not already imported)

// --- MAP CUSTOMERS endpoint for admin live map ---
export const getMapCustomers = async (req: Request, res: Response) => {
  try {
    const customers = await prisma.user.findMany({
      where: {
        role: "CUSTOMER",
        online: true,
        lat: { not: null },
        lng: { not: null },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        vehicleType: true,
        lat: true,
        lng: true,
        online: true,
      },
    });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch map customers" });
  }
};

// --- Rides endpoint (sortable, paginated, scheduled rides show first, with local time zone!) ---
export const getRides = async (req: Request, res: Response) => {
  try {
    const allowedFields = ["id", "requestedAt", "scheduledAt"];
    const { sortBy, order } = getSortParams(req.query, allowedFields, "requestedAt", "desc");
    const { take, skip } = getPagination(req.query);

    const rides = await prisma.ride.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        driver: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: [
        { status: "asc" },           // SCHEDULED (or lowest status alphabetically) first
        { [sortBy]: order as any }
      ],
      skip,
      take
    });

    // For each ride, add scheduledAt in pickup local time zone
    const ridesWithLocalTime = await Promise.all(
      rides.map(async ride => {
        let localTimeZone = "UTC";
        if (ride.originLat && ride.originLng) {
          localTimeZone = await getTimeZoneFromCoords(ride.originLat, ride.originLng);
        }
        const scheduledAtLocal = ride.scheduledAt
          ? utcToLocal(ride.scheduledAt.toISOString(), localTimeZone)
          : null;
        return {
          ...ride,
          scheduledAtLocal,
          pickupTimeZone: localTimeZone,
        };
      })
    );

    res.json(ridesWithLocalTime);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch rides" });
  }
};

// --- SCHEDULED RIDE FOR CUSTOMER ---
export const getCustomerScheduledRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = Number(req.params.id);
    const scheduledRide = await prisma.ride.findFirst({
      where: { customerId, status: RideStatus.SCHEDULED },
      include: { driver: true, customer: true },
      orderBy: { scheduledAt: "asc" }
    });
    if (!scheduledRide) return res.status(404).json({});
    let localTimeZone = "UTC";
    if (scheduledRide.originLat && scheduledRide.originLng) {
      localTimeZone = await getTimeZoneFromCoords(scheduledRide.originLat, scheduledRide.originLng);
    }
    const scheduledAtLocal = scheduledRide.scheduledAt
      ? utcToLocal(scheduledRide.scheduledAt.toISOString(), localTimeZone)
      : null;
    res.json({ ...scheduledRide, scheduledAtLocal, pickupTimeZone: localTimeZone });
  } catch (error) {
    next(error);
  }
};

// --- SCHEDULED RIDE FOR DRIVER ---
export const getDriverScheduledRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = Number(req.params.id);
    const scheduledRide = await prisma.ride.findFirst({
      where: { driverId, status: RideStatus.SCHEDULED },
      include: { driver: true, customer: true },
      orderBy: { scheduledAt: "asc" }
    });
    if (!scheduledRide) return res.status(404).json({});
    let localTimeZone = "UTC";
    if (scheduledRide.originLat && scheduledRide.originLng) {
      localTimeZone = await getTimeZoneFromCoords(scheduledRide.originLat, scheduledRide.originLng);
    }
    const scheduledAtLocal = scheduledRide.scheduledAt
      ? utcToLocal(scheduledRide.scheduledAt.toISOString(), localTimeZone)
      : null;
    res.json({ ...scheduledRide, scheduledAtLocal, pickupTimeZone: localTimeZone });
  } catch (error) {
    next(error);
  }
};

// --- NO SHOW COUNTS FOR CUSTOMER/DRIVER ---
export const getCustomerNoShowCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = Number(req.params.id);
    const count = await prisma.ride.count({
      where: { customerId, status: RideStatus.NO_SHOW },
    });
    res.json({ customerId, noShowCount: count });
  } catch (error) {
    next(error);
  }
};
export const getDriverNoShowCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = Number(req.params.id);
    const count = await prisma.ride.count({
      where: { driverId, status: RideStatus.NO_SHOW },
    });
    res.json({ driverId, noShowCount: count });
  } catch (error) {
    next(error);
  }
};

// --- ASSIGN DRIVER TO SCHEDULED RIDE ---
export const assignDriverToScheduledRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rideId = Number(req.params.rideId);
    const driverId = Number(req.body.driverId);

    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.status !== RideStatus.SCHEDULED) {
      return res.status(400).json({ error: "Ride is not scheduled" });
    }

    // Get local pickup time zone for summary
    let localTimeZone = "UTC";
    if (ride.originLat && ride.originLng) {
      localTimeZone = await getTimeZoneFromCoords(ride.originLat, ride.originLng);
    }
    const scheduledAtLocal = ride.scheduledAt
      ? utcToLocal(ride.scheduledAt.toISOString(), localTimeZone)
      : null;

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { driverId },
      include: { driver: true, customer: true }
    });

    res.json({
      message: "Driver assigned to scheduled ride",
      ride: { ...updated, scheduledAtLocal, pickupTimeZone: localTimeZone }
    });
  } catch (error) {
    next(error);
  }
};
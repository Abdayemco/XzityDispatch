import { Request, Response, NextFunction } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { VehicleType, RideStatus, Role } from "@prisma/client";
import { DateTime } from "luxon";

const LOCAL_TZ = "Africa/Cairo";

// Helper to normalize and validate vehicleType input (case-insensitive)
function normalizeVehicleType(input: any): VehicleType | undefined {
  if (!input || typeof input !== "string") return undefined;
  const upper = input.trim().toUpperCase();
  if (Object.values(VehicleType).includes(upper as VehicleType)) {
    return upper as VehicleType;
  }
  return undefined;
}

// Helper to convert UTC date (or null) to ISO string in local timezone
function toLocalISOString(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return DateTime.fromISO(new Date(date).toISOString(), { zone: "utc" })
    .setZone(LOCAL_TZ)
    .toISO({ suppressMilliseconds: true });
}

// Helper to format time for display (e.g., "yyyy-MM-dd HH:mm")
function toLocalDisplay(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return DateTime.fromISO(new Date(date).toISOString(), { zone: "utc" })
    .setZone(LOCAL_TZ)
    .toFormat("yyyy-MM-dd HH:mm");
}

// Helper to return just the time (HH:mm) from UTC date
function toLocalHHmm(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  return DateTime.fromISO(new Date(date).toISOString(), { zone: "utc" })
    .setZone(LOCAL_TZ)
    .toFormat("HH:mm");
}

// Helper to calculate distance between two points in km
function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Helper to estimate ETA in minutes given distance in km
function estimateTimeMin(distanceKm: number, averageKmh: number = 30): number {
  if (!distanceKm || distanceKm <= 0) return 0;
  return Math.ceil((distanceKm / averageKmh) * 60);
}

export async function isDriverBusy(driverId: number) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const busyRide = await prisma.ride.findFirst({
    where: {
      driverId,
      OR: [
        {
          status: RideStatus.ACCEPTED,
          acceptedAt: {
            gte: fifteenMinutesAgo,
          },
        },
        {
          status: RideStatus.IN_PROGRESS,
          startedAt: {
            gte: fifteenMinutesAgo,
          },
        },
      ],
      NOT: [
        { status: RideStatus.COMPLETED },
        { status: RideStatus.CANCELLED },
        { status: RideStatus.NO_SHOW },
      ],
    },
  });
  return !!busyRide;
}

// --- AUTO-CANCEL UNACCEPTED RIDES ---
export async function cleanupUnacceptedRides() {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60000);

  // Cancel regular rides (pending) older than 1 hour and unassigned
  const regular = await prisma.ride.updateMany({
    where: {
      status: RideStatus.PENDING,
      driverId: null,
      requestedAt: { lt: oneHourAgo },
    },
    data: {
      status: RideStatus.CANCELLED,
      cancelledAt: now,
    },
  });

  // Cancel scheduled rides that have not been accepted 1 hour after scheduledAt
  const scheduled = await prisma.ride.updateMany({
    where: {
      status: RideStatus.SCHEDULED,
      driverId: null,
      scheduledAt: { not: null, lt: oneHourAgo },
    },
    data: {
      status: RideStatus.CANCELLED,
      cancelledAt: now,
    },
  });

  if (regular.count > 0 || scheduled.count > 0) {
    console.log(
      `[Cleanup] Auto-cancelled ${regular.count} regular and ${scheduled.count} scheduled rides (unaccepted after 1h).`
    );
  }
}

/**
 * CLEANUP JOB: Cancels "stuck" rides still in ACCEPTED/IN_PROGRESS after 15 minutes.
 */
export async function cleanupStuckRides() {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  const result1 = await prisma.ride.updateMany({
    where: {
      status: RideStatus.ACCEPTED,
      acceptedAt: { lt: fifteenMinutesAgo },
    },
    data: {
      status: RideStatus.CANCELLED,
      cancelledAt: new Date(),
    },
  });
  const result2 = await prisma.ride.updateMany({
    where: {
      status: RideStatus.IN_PROGRESS,
      startedAt: { lt: fifteenMinutesAgo },
    },
    data: {
      status: RideStatus.CANCELLED,
      cancelledAt: new Date(),
    },
  });
  if (result1.count > 0 || result2.count > 0) {
    console.log(
      `[Cleanup] Cancelled ${result1.count} ACCEPTED and ${result2.count} IN_PROGRESS stuck rides.`
    );
  }
}

// --- CREATE RIDE (REGULAR OR SCHEDULED) ---
export const requestRide = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      customerId,
      originLat,
      originLng,
      destLat,
      destLng,
      destinationName,
      note,
      vehicleType,
      scheduledAt, // optional, ISO string for scheduled ride (should be in local time!)
    } = req.body;

    const normalizedVehicleType = normalizeVehicleType(vehicleType);

    const numericCustomerId = Number(customerId);
    if (
      !numericCustomerId ||
      typeof numericCustomerId !== "number" ||
      isNaN(numericCustomerId) ||
      typeof originLat !== "number" ||
      typeof originLng !== "number" ||
      typeof destLat !== "number" ||
      typeof destLng !== "number" ||
      !normalizedVehicleType
    ) {
      return res
        .status(400)
        .json({ error: "Missing or invalid required fields" });
    }

    // Convert scheduledAt (if provided) from local time to UTC for DB storage
    let scheduledAtUTC: Date | undefined = undefined;
    if (scheduledAt) {
      const dt = DateTime.fromISO(scheduledAt, { zone: LOCAL_TZ });
      if (dt.isValid) {
        scheduledAtUTC = new Date(dt.toUTC().toString());
      }
    }

    // If scheduledAt supplied, create as SCHEDULED ride
    const ride = await prisma.ride.create({
      data: {
        customer: { connect: { id: numericCustomerId } },
        status: scheduledAt ? RideStatus.SCHEDULED : RideStatus.PENDING,
        originLat,
        originLng,
        destLat,
        destLng,
        destinationName:
          typeof destinationName === "string" && destinationName.trim()
            ? destinationName.trim()
            : null,
        note: typeof note === "string" && note.trim() ? note.trim() : null,
        vehicleType: normalizedVehicleType,
        scheduledAt: scheduledAtUTC,
      },
    });

    res.json({
      rideId: ride.id,
      status: ride.status,
      scheduledAt: toLocalISOString(ride.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(ride.scheduledAt),
      destinationName: ride.destinationName,
      note: ride.note,
    });
  } catch (error) {
    console.error("Error creating ride:", error);
    next(error);
  }
};

// --- EDIT SCHEDULED RIDE ---
export const editScheduledRide = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const rideId = Number(req.params.rideId);
    const {
      customerId,
      originLat,
      originLng,
      destLat,
      destLng,
      destinationName,
      note,
      vehicleType,
      scheduledAt,
      timeZone,
    } = req.body;

    if (!rideId) return res.status(400).json({ error: "Missing rideId" });
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.status !== RideStatus.SCHEDULED) {
      return res.status(400).json({ error: "Only scheduled rides can be edited" });
    }
    if (customerId && ride.customerId !== +customerId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Parse and convert scheduledAt if given
    let scheduledAtUTC: Date | undefined = undefined;
    if (scheduledAt) {
      const zone = timeZone || LOCAL_TZ;
      const dt = DateTime.fromISO(scheduledAt, { zone });
      if (dt.isValid) {
        scheduledAtUTC = new Date(dt.toUTC().toString());
      }
    }

    const data: any = {};
    if (originLat !== undefined) data.originLat = originLat;
    if (originLng !== undefined) data.originLng = originLng;
    if (destLat !== undefined) data.destLat = destLat;
    if (destLng !== undefined) data.destLng = destLng;
    if (destinationName !== undefined) data.destinationName = destinationName;
    if (note !== undefined) data.note = note;
    if (vehicleType !== undefined)
      data.vehicleType = normalizeVehicleType(vehicleType);
    if (scheduledAtUTC !== undefined) data.scheduledAt = scheduledAtUTC;

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data,
    });

    res.json({
      rideId: updated.id,
      status: updated.status,
      scheduledAt: toLocalISOString(updated.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(updated.scheduledAt),
      destinationName: updated.destinationName,
      note: updated.note,
    });
  } catch (error) {
    console.error("Error editing scheduled ride:", error);
    next(error);
  }
};

// --- CANCEL RIDE (any status, including scheduled) ---
export const cancelRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rideId = Number(req.params.rideId);
    if (!rideId) {
      return res.status(400).json({ error: "Invalid rideId" });
    }
    const ride = await prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.CANCELLED, cancelledAt: new Date() },
      include: {
        customer: true,
        driver: true,
      },
    });
    res.json({
      message: "Ride cancelled",
      rideId: ride.id,
      status: ride.status,
      cancelledAt: toLocalISOString(ride.cancelledAt),
      cancelledAtDisplay: toLocalDisplay(ride.cancelledAt),
      customer: ride.customer ? { id: ride.customer.id, name: ride.customer.name } : undefined,
      driver: ride.driver ? { id: ride.driver.id, name: ride.driver.name } : undefined,
    });
  } catch (error) {
    console.error("Error cancelling ride:", error);
    next(error);
  }
};

// --- MARK RIDE AS DONE (any status, including scheduled) ---
export const markRideAsDone = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rideId = Number(req.params.rideId);
    if (!rideId) {
      return res.status(400).json({ error: "Invalid rideId" });
    }
    const ride = await prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.COMPLETED, completedAt: new Date() },
      include: {
        customer: true,
        driver: true,
      },
    });
    res.json({
      message: "Ride marked as completed",
      rideId: ride.id,
      status: ride.status,
      completedAt: toLocalISOString(ride.completedAt),
      completedAtDisplay: toLocalDisplay(ride.completedAt),
      customer: ride.customer ? { id: ride.customer.id, name: ride.customer.name } : undefined,
      driver: ride.driver ? { id: ride.driver.id, name: ride.driver.name } : undefined,
    });
  } catch (error) {
    console.error("Error marking ride as done:", error);
    next(error);
  }
};

// --- GET ALL RIDES FOR CUSTOMER (SCHEDULED, ACTIVE, DONE, CANCELLED) ---
export const getAllCustomerRides = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let customerId: number | undefined;
    if (req.query.customerId) {
      customerId = Number(req.query.customerId);
    } else if (req.user && typeof req.user === "object" && "id" in req.user) {
      customerId = (req.user as any).id;
    }
    if (!customerId || isNaN(customerId)) {
      return res.status(400).json({ error: "Missing or invalid customerId" });
    }

    const rides = await prisma.ride.findMany({
      where: {
        customerId,
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        driver: true,
      },
    });

    // Show all rides for customer (including cancelled for notification purposes)
    const formattedRides = rides.map(r => {
      // Add requestedAtTime (HH:mm only)
      const requestedAtTime = r.requestedAt ? toLocalHHmm(r.requestedAt) : null;
      // Add driver's lastKnownLat/lastKnownLng
      let eta = null;
      let etaKm = null;
      let etaMin = null;
      if (
        r.driver &&
        r.driver.lastKnownLat != null && r.driver.lastKnownLng != null &&
        r.originLat != null && r.originLng != null
      ) {
        const distanceKm = getDistanceKm(
          r.driver.lastKnownLat,
          r.driver.lastKnownLng,
          r.originLat,
          r.originLng
        );
        etaKm = Number(distanceKm.toFixed(1));
        etaMin = estimateTimeMin(distanceKm);
        eta = { etaMin, etaKm };
      }
      return {
        id: r.id,
        scheduledAt: toLocalISOString(r.scheduledAt),
        scheduledAtDisplay: toLocalDisplay(r.scheduledAt),
        vehicleType: r.vehicleType,
        destinationName: r.destinationName,
        note: r.note,
        status: r.status,
        acceptedAt: toLocalISOString(r.acceptedAt),
        requestedAtTime, // <-- just the time (HH:mm)
        driver: r.driver
          ? {
              id: r.driver.id,
              name: r.driver.name,
              vehicleType: r.driver.vehicleType,
              lastKnownLat: r.driver.lastKnownLat,
              lastKnownLng: r.driver.lastKnownLng,
              acceptedAt: toLocalISOString(r.acceptedAt),
            }
          : undefined,
        etaMin: etaMin ?? null, // <-- ETA in minutes (null if no driver)
        etaKm: etaKm ?? null,   // <-- ETA in km (null if no driver)
        rated: r.rating !== null && r.rating !== undefined,
      };
    });

    res.json(formattedRides);
  } catch (error) {
    console.error("Error fetching all rides for customer:", error);
    next(error);
  }
};

// --- GET ALL RIDES FOR DRIVER (SCHEDULED, ACTIVE, DONE, CANCELLED) ---
export const getAllDriverRides = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let driverId: number | undefined;
    if (req.query.driverId) {
      driverId = Number(req.query.driverId);
    } else if (req.user && typeof req.user === "object" && "id" in req.user) {
      driverId = (req.user as any).id;
    }
    if (!driverId || isNaN(driverId)) {
      return res.status(400).json({ error: "Missing or invalid driverId" });
    }

    const rides = await prisma.ride.findMany({
      where: {
        driverId,
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        customer: true,
      },
    });

    // Show all rides for driver (including cancelled/completed)
    const formattedRides = rides.map(r => ({
      id: r.id,
      originLat: r.originLat,
      originLng: r.originLng,
      destLat: r.destLat,
      destLng: r.destLng,
      scheduledAt: toLocalISOString(r.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(r.scheduledAt),
      vehicleType: r.vehicleType,
      destinationName: r.destinationName,
      note: r.note,
      status: r.status,
      acceptedAt: toLocalISOString(r.acceptedAt),
      startedAt: toLocalISOString(r.startedAt),
      completedAt: toLocalISOString(r.completedAt),
      cancelledAt: toLocalISOString(r.cancelledAt),
      noShowReportedAt: toLocalISOString(r.noShowReportedAt),
      customer: r.customer ? {
        id: r.customer.id,
        name: r.customer.name,
      } : undefined,
      rated: r.rating !== null && r.rating !== undefined,
    }));

    res.json(formattedRides);
  } catch (error) {
    console.error("Error fetching all rides for driver:", error);
    next(error);
  }
};

// --- GET AVAILABLE REQUESTS FOR PROVIDER (DRIVER/SHOPPER/HAIR_DRESSER/INSTITUTE) ---
function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const getAvailableRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const providerId = Number(req.query.providerId);
    if (!providerId) {
      return res.status(401).json({ error: "Unauthorized: Missing provider id" });
    }
    // Get full provider profile
    const provider = await prisma.user.findUnique({
      where: { id: providerId }
    });
    if (!provider) {
      return res.status(404).json({ error: "Provider not found" });
    }

    const role = provider.role;
    let rides: any[] = [];

    // --- DRIVER LOGIC (PATCHED AND COMPLETE) ---
    if (role === Role.DRIVER) {
      let rideTypes: VehicleType[] = [];
      switch (provider.vehicleType) {
        case "CAR":
          rideTypes = ["CAR", "TUKTUK", "DELIVERY", "SHOPPING"];
          break;
        case "TUKTUK":
          rideTypes = ["TUKTUK", "DELIVERY", "SHOPPING"];
          break;
        case "DELIVERY":
          rideTypes = ["DELIVERY", "SHOPPING"];
          break;
        case "SHOPPING":
          rideTypes = ["SHOPPING", "DELIVERY"];
          break;
        case "TOW_TRUCK":
          rideTypes = ["TOW_TRUCK", "TRUCK"];
          break;
        case "WHEELCHAIR":
          rideTypes = ["WHEELCHAIR", "CAR", "TUKTUK", "DELIVERY", "SHOPPING"];
          break;
        case "CLEANING":
          rideTypes = ["CLEANING"];
          break;
        case "HAIR_DRESSER":
          rideTypes = ["HAIR_DRESSER"];
          break;
        case "INSTITUTE":
          rideTypes = ["INSTITUTE"];
          break;
        case "LIMO":
          rideTypes = ["LIMO"];
          break;
        case "TRUCK":
          rideTypes = ["TRUCK"];
          break;
        case "WATER_TRUCK":
          rideTypes = ["WATER_TRUCK"];
          break;
        default:
          rideTypes = [provider.vehicleType];
      }

      const now = new Date();
      const thirtyMinFromNow = new Date(now.getTime() + 30 * 60000);
      const oneHourAgo = new Date(now.getTime() - 60 * 60000);

      rides = await prisma.ride.findMany({
        where: {
          OR: [
            {
              status: RideStatus.SCHEDULED,
              scheduledAt: {
                lte: thirtyMinFromNow,
                gte: oneHourAgo,
              },
              driverId: null,
              vehicleType: { in: rideTypes },
            },
            {
              status: RideStatus.PENDING,
              driverId: null,
              requestedAt: { gte: oneHourAgo },
              vehicleType: { in: rideTypes },
            }
          ]
        },
        select: {
          id: true,
          originLat: true,
          originLng: true,
          vehicleType: true,
          requestedAt: true,
          customer: { select: { name: true } },
          scheduledAt: true,
          status: true,
          destLat: true,
          destLng: true,
          destinationName: true,
          note: true,
        },
        orderBy: { scheduledAt: "asc" }
      });
    }
    // --- SHOPPER LOGIC (future extension, filter jobs by type) ---
    else if (role === Role.SHOPPER) {
      rides = []; // Placeholder for future shopping jobs
    }
    // --- HAIR_DRESSER LOGIC ---
    else if (role === Role.HAIR_DRESSER) {
      rides = await prisma.ride.findMany({
        where: {
          status: { in: [RideStatus.PENDING, RideStatus.SCHEDULED] },
          driverId: null,
          note: { contains: "hair", mode: Prisma.QueryMode.insensitive },
        },
        select: {
          id: true,
          originLat: true,
          originLng: true,
          requestedAt: true,
          customer: { select: { name: true } },
          scheduledAt: true,
          status: true,
          destLat: true,
          destLng: true,
          destinationName: true,
          note: true,
        },
        orderBy: { scheduledAt: "asc" }
      });
      // Safe null check for provider.hairType
      if (provider.hairType && provider.hairType !== "") {
        rides = rides.filter(r =>
          !r.note ||
          r.note.toLowerCase().includes((provider.hairType ?? "").toLowerCase())
        );
      }
    }
    // --- INSTITUTE LOGIC ---
    else if (role === Role.INSTITUTE) {
      let serviceKeywords: string[] = [];
      if (provider.beautyServices) {
        serviceKeywords = provider.beautyServices.split(",").map(s => s.trim().toLowerCase());
      }
      rides = await prisma.ride.findMany({
        where: {
          status: { in: [RideStatus.PENDING, RideStatus.SCHEDULED] },
          driverId: null,
          OR: [
            { note: { contains: "beauty", mode: Prisma.QueryMode.insensitive } },
            ...serviceKeywords.map(sk => ({
              note: { contains: sk, mode: Prisma.QueryMode.insensitive }
            }))
          ]
        },
        select: {
          id: true,
          originLat: true,
          originLng: true,
          requestedAt: true,
          customer: { select: { name: true } },
          scheduledAt: true,
          status: true,
          destLat: true,
          destLng: true,
          destinationName: true,
          note: true,
        },
        orderBy: { scheduledAt: "asc" }
      });
    }
    // --- DEFAULT: No results for other roles ---
    else {
      rides = [];
    }

    // Location-based filtering (optional, 33km radius)
    const lat = req.query.lat ? Number(req.query.lat) : null;
    const lng = req.query.lng ? Number(req.query.lng) : null;
    let filteredRides = rides;
    if (lat && lng && !isNaN(lat) && !isNaN(lng)) {
      filteredRides = rides.filter(ride => {
        if (
          typeof ride.originLat !== "number" ||
          typeof ride.originLng !== "number"
        ) return false;
        const distKm = haversineDistanceKm(lat, lng, ride.originLat, ride.originLng);
        return distKm <= 33;
      });
    }

    // Map output for frontend
    const mappedRides = filteredRides.map(ride => ({
      id: ride.id,
      pickupLat: ride.originLat,
      pickupLng: ride.originLng,
      customerName: ride.customer?.name || "",
      requestedAt: ride.requestedAt,
      scheduledAt: toLocalISOString(ride.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(ride.scheduledAt),
      destinationLat: ride.destLat,
      destinationLng: ride.destLng,
      destinationName: ride.destinationName,
      note: ride.note,
      status: ride.status,
    }));

    res.json(mappedRides);
  } catch (error) {
    console.error("Error fetching available requests for provider:", error);
    next(error);
  }
};

// --- DRIVER ACCEPTS A RIDE (SCHEDULED OR REGULAR) ---
export const acceptRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = Number(req.query.driverId);
    if (!driverId) {
      return res.status(401).json({ error: "Unauthorized: Missing driver id" });
    }
    const busy = await isDriverBusy(driverId);
    if (busy) {
      return res.status(400).json({ error: "You already have an active or recent job. Finish it or wait 15 minutes before accepting a new one." });
    }
    const rideId = Number(req.params.rideId);

    // Accept pending or scheduled ride
    const ride = await prisma.ride.updateMany({
      where: {
        id: rideId,
        driverId: null,
        status: { in: [RideStatus.PENDING, RideStatus.SCHEDULED] }
      },
      data: { status: RideStatus.ACCEPTED, driverId, acceptedAt: new Date() },
    });

    if (ride.count === 0) {
      return res.status(400).json({ error: "Ride already assigned or not available." });
    }

    await prisma.user.update({
      where: { id: driverId },
      data: { isBusy: true },
    });

    const updatedRide = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { customer: true, driver: true }
    });

    if (!updatedRide) return res.status(404).json({ error: "Ride not found" });

    res.json({
      ...updatedRide,
      scheduledAt: toLocalISOString(updatedRide.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(updatedRide.scheduledAt),
      acceptedAt: toLocalISOString(updatedRide.acceptedAt),
      startedAt: toLocalISOString(updatedRide.startedAt),
      completedAt: toLocalISOString(updatedRide.completedAt),
      cancelledAt: toLocalISOString(updatedRide.cancelledAt),
      noShowReportedAt: toLocalISOString(updatedRide.noShowReportedAt),
      driver: updatedRide.driver
        ? {
            id: updatedRide.driver.id,
            name: updatedRide.driver.name,
            vehicleType: updatedRide.driver.vehicleType,
            lastKnownLat: updatedRide.driver.lastKnownLat,
            lastKnownLng: updatedRide.driver.lastKnownLng,
            acceptedAt: toLocalISOString(updatedRide.acceptedAt),
          }
        : undefined,
    });
  } catch (error) {
    console.error("Error accepting ride:", error);
    next(error);
  }
};

// --- DRIVER STARTS A RIDE ---
export const startRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = Number(req.query.driverId);
    const rideId = Number(req.params.rideId);

    if (!driverId || !rideId) {
      return res.status(400).json({ error: "Invalid driverId or rideId" });
    }

    // Only allow starting if accepted
    const ride = await prisma.ride.findFirst({
      where: {
        id: rideId,
        driverId,
        status: RideStatus.ACCEPTED,
      },
    });

    if (!ride) {
      return res.status(400).json({ error: "Ride not found or not accepted by you." });
    }

    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.IN_PROGRESS, startedAt: new Date() },
    });

    res.json({
      status: "in_progress",
      ride: {
        ...updated,
        scheduledAt: toLocalISOString(updated.scheduledAt),
        scheduledAtDisplay: toLocalDisplay(updated.scheduledAt),
        startedAt: toLocalISOString(updated.startedAt),
      },
    });
  } catch (error) {
    console.error("Error starting ride:", error);
    next(error);
  }
};

// --- DRIVER MARKS RIDE AS "NO SHOW" ---
export const markRideNoShow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = Number(req.query.driverId);
    const rideId = Number(req.params.rideId);

    if (!driverId || !rideId) {
      return res.status(400).json({ error: "Invalid driverId or rideId" });
    }

    // Only scheduled rides, after scheduledAt + grace period
    const ride = await prisma.ride.findUnique({ where: { id: rideId } });
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    if (ride.status !== RideStatus.SCHEDULED) {
      return res.status(400).json({ error: "Ride is not scheduled" });
    }
    const graceMs = 10 * 60 * 1000;
    const now = Date.now();
    const scheduledTime = ride.scheduledAt ? new Date(ride.scheduledAt).getTime() : null;
    if (!scheduledTime || now < scheduledTime + graceMs) {
      return res.status(400).json({ error: "Cannot mark No Show before scheduled time + 10 min grace period." });
    }
    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.NO_SHOW, noShowReportedAt: new Date() },
    });

    res.json({
      message: "Ride marked as No Show",
      ride: {
        ...updated,
        scheduledAt: toLocalISOString(updated.scheduledAt),
        scheduledAtDisplay: toLocalDisplay(updated.scheduledAt),
        noShowReportedAt: toLocalISOString(updated.noShowReportedAt),
      }
    });
  } catch (error) {
    console.error("Error marking ride as No Show:", error);
    next(error);
  }
};

// --- GET RIDE STATUS FOR POLLING ---
export const getRideStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rideId = Number(req.params.rideId);
    if (!rideId) {
      return res.status(400).json({ error: "Invalid rideId" });
    }
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true, scheduledAt: true }
    });
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }
    let statusForFrontend: string;
    switch (ride.status) {
      case RideStatus.PENDING:
        statusForFrontend = "pending";
        break;
      case RideStatus.ACCEPTED:
        statusForFrontend = "accepted";
        break;
      case RideStatus.IN_PROGRESS:
        statusForFrontend = "in_progress";
        break;
      case RideStatus.CANCELLED:
        statusForFrontend = "cancelled";
        break;
      case RideStatus.COMPLETED:
        statusForFrontend = "done";
        break;
      case RideStatus.NO_SHOW:
        statusForFrontend = "no_show";
        break;
      case RideStatus.SCHEDULED:
        statusForFrontend = "scheduled";
        break;
      default:
        statusForFrontend = String(ride.status || "unknown").toLowerCase();
    }
    return res.json({
      status: statusForFrontend,
      scheduledAt: toLocalISOString(ride.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(ride.scheduledAt),
    });
  } catch (error) {
    console.error("Error fetching ride status:", error);
    next(error);
  }
};

// --- CUSTOMER RATES RIDE ---
export const rateRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rideId = Number(req.params.rideId);
    const { rating, feedback } = req.body;

    if (!rideId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Invalid rideId or rating (must be 1-5)" });
    }
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true, rating: true }
    });
    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }
    if (ride.status !== RideStatus.COMPLETED) {
      return res.status(400).json({ error: "Can only rate completed rides" });
    }
    if (ride.rating !== null && ride.rating !== undefined) {
      return res.status(400).json({ error: "Ride already rated" });
    }
    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { rating, feedback }
    });
    res.json({ message: "Thank you for rating your driver!", ride: updated });
  } catch (error) {
    console.error("Error rating ride:", error);
    next(error);
  }
};

// --- GET CURRENT RIDE FOR CUSTOMER/DRIVER ---
export const getCurrentRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string };
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const role = user.role?.toLowerCase();
    let where: any = {};
    if (role === "customer") {
      const now = new Date();
      const thirtyMinFromNow = new Date(now.getTime() + 30 * 60000);
      where = {
        customerId: user.id,
        OR: [
          { status: { in: [RideStatus.PENDING, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] } },
          { status: RideStatus.SCHEDULED, scheduledAt: { lte: thirtyMinFromNow } }
        ],
      };
    } else if (role === "driver") {
      where = {
        driverId: user.id,
        status: { in: [RideStatus.PENDING, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS, RideStatus.SCHEDULED] },
      };
    } else {
      return res.status(400).json({ error: "Invalid user role" });
    }
    const ride = await prisma.ride.findFirst({
      where,
      include: {
        driver: true,
        customer: true,
      }
    });
    if (!ride) return res.status(404).json({ error: "No active ride" });
    res.json({
      rideId: ride.id,
      rideStatus:
        ride.status === RideStatus.PENDING
          ? "pending"
          : ride.status === RideStatus.ACCEPTED
          ? "accepted"
          : ride.status === RideStatus.IN_PROGRESS
          ? "in_progress"
          : ride.status === RideStatus.CANCELLED
          ? "cancelled"
          : ride.status === RideStatus.COMPLETED
          ? "done"
          : ride.status === RideStatus.NO_SHOW
          ? "no_show"
          : ride.status === RideStatus.SCHEDULED
          ? "scheduled"
          : String(ride.status).toLowerCase(),
      originLat: ride.originLat,
      originLng: ride.originLng,
      vehicleType: (ride.vehicleType || "").toLowerCase(),
      driver: ride.driver
        ? {
            id: ride.driver.id,
            name: ride.driver.name,
            vehicleType: (ride.driver.vehicleType || "").toLowerCase(),
            lastKnownLat: ride.driver.lastKnownLat,
            lastKnownLng: ride.driver.lastKnownLng,
            acceptedAt: toLocalISOString(ride.acceptedAt),
          }
        : undefined,
      customer: ride.customer
        ? {
            id: ride.customer.id,
            name: ride.customer.name,
          }
        : undefined,
      scheduledAt: toLocalISOString(ride.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(ride.scheduledAt),
      destLat: ride.destLat,
      destLng: ride.destLng,
      destinationName: ride.destinationName ?? undefined,
      note: ride.note ?? undefined,
      acceptedAt: toLocalISOString(ride.acceptedAt),
    });
  } catch (error) {
    console.error("Error fetching current ride:", error);
    next(error);
  }
};

/**
 * NEW: CUSTOMER LOCATION UPDATE ENDPOINT
 */
export const updateCustomerLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, lat, lng, timestamp } = req.body;
    const numericCustomerId = Number(customerId);
    if (
      !numericCustomerId ||
      typeof numericCustomerId !== "number" ||
      isNaN(numericCustomerId) ||
      typeof lat !== "number" ||
      typeof lng !== "number"
    ) {
      return res
        .status(400)
        .json({ error: "Missing or invalid required fields" });
    }
    await prisma.user.update({
      where: { id: numericCustomerId },
      data: {
        lastKnownLat: lat,
        lastKnownLng: lng,
        lastLocationAt: timestamp ? new Date(timestamp) : new Date(),
      },
    });
    return res.json({ success: true });
  } catch (error) {
    console.error("Error updating customer location:", error);
    next(error);
  }
};

export const getAvailableRides = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Implement your logic for fetching available rides for drivers here
    res.json([]); // placeholder
  } catch (error) {
    next(error);
  }
};
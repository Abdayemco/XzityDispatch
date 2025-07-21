import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { VehicleType, RideStatus } from "@prisma/client";
import { DateTime } from "luxon";

const LOCAL_TZ = "Africa/Cairo"; // Set your local timezone here

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

// Helper to check if a driver is busy with a ride (ACCEPTED/IN_PROGRESS) that started less than 15 min ago
async function isDriverBusy(driverId: number) {
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

// --- CREATE RIDE (REGULAR OR SCHEDULED) ---
export const requestRide = async (req: Request, res: Response, next: NextFunction) => {
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
      return res.status(400).json({ error: "Missing or invalid required fields" });
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
        destinationName: typeof destinationName === "string" && destinationName.trim() ? destinationName.trim() : null,
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

// --- GET AVAILABLE RIDES FOR DRIVER (SCHEDULED & REGULAR) ---
export const getAvailableRides = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = Number(req.query.driverId);
    if (!driverId) {
      return res.status(401).json({ error: "Unauthorized: Missing driver id" });
    }
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { vehicleType: true },
    });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    let rideTypes: VehicleType[] = [];
    if (driver.vehicleType === "TOW_TRUCK") {
      rideTypes = ["TOW_TRUCK", "TRUCK"];
    } else if (driver.vehicleType === "WHEELCHAIR") {
      rideTypes = ["WHEELCHAIR", "CAR", "DELIVERY", "TUKTUK"];
    } else if (driver.vehicleType === "CAR" || driver.vehicleType === "TUKTUK") {
      rideTypes = [driver.vehicleType, "DELIVERY"];
    } else if (driver.vehicleType) {
      rideTypes = [driver.vehicleType];
    }

    // Scheduled rides logic: show only within 30 min before pickup
    const now = new Date();
    const thirtyMinFromNow = new Date(now.getTime() + 30 * 60000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);

    const rides = await prisma.ride.findMany({
      where: {
        OR: [
          // Scheduled rides: visible 30min before scheduledAt up to 1hr after
          {
            status: RideStatus.SCHEDULED,
            scheduledAt: {
              lte: thirtyMinFromNow,
              gte: oneHourAgo,
            },
            driverId: null,
            vehicleType: { in: rideTypes },
          },
          // Regular rides: not yet accepted/in_progress/done/cancelled
          {
            status: RideStatus.PENDING,
            driverId: null,
            vehicleType: { in: rideTypes },
          }
        ]
      },
      select: {
        id: true,
        originLat: true,
        originLng: true,
        vehicleType: true,
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

    const mappedRides = rides.map(ride => ({
      id: ride.id,
      pickupLat: ride.originLat,
      pickupLng: ride.originLng,
      customerName: ride.customer?.name || "",
      vehicleType: ride.vehicleType,
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
    console.error("Error fetching available rides:", error);
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

    // Convert ride times for response
    res.json({
      ...updatedRide,
      scheduledAt: toLocalISOString(updatedRide.scheduledAt),
      scheduledAtDisplay: toLocalDisplay(updatedRide.scheduledAt),
      acceptedAt: toLocalISOString(updatedRide.acceptedAt),
      startedAt: toLocalISOString(updatedRide.startedAt),
      completedAt: toLocalISOString(updatedRide.completedAt),
      cancelledAt: toLocalISOString(updatedRide.cancelledAt),
      noShowReportedAt: toLocalISOString(updatedRide.noShowReportedAt),
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
    const graceMs = 10 * 60 * 1000; // 10 min grace period
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
      // Only consider scheduled rides as "current" if within 30min of scheduledAt
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
    });
  } catch (error) {
    console.error("Error fetching current ride:", error);
    next(error);
  }
};

// --- MARK RIDE AS DONE ---
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

// --- CANCEL RIDE ---
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

/**
 * CLEANUP JOB: Cancels "stuck" rides still in ACCEPTED/IN_PROGRESS after 15 minutes.
 * Should be imported and started in index.ts
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
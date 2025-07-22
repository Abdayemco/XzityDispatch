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
      scheduledAt // optional, ISO string for scheduled ride (should be in local time!)
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

// --- EDIT SCHEDULED RIDE (NEW ENDPOINT) ---
export const editScheduledRide = async (req: Request, res: Response, next: NextFunction) => {
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
    if (vehicleType !== undefined) data.vehicleType = normalizeVehicleType(vehicleType);
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

// --- GET AVAILABLE RIDES FOR DRIVER (SCHEDULED & REGULAR) ---
// (unchanged from your version)
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

    const now = new Date();
    const thirtyMinFromNow = new Date(now.getTime() + 30 * 60000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60000);

    const rides = await prisma.ride.findMany({
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

// --- The rest of your existing controller remains unchanged (accept, start, markRideNoShow, getRideStatus, rateRide, getCurrentRide, cleanupStuckRides) ---

// ...Paste other unchanged functions from your file here...

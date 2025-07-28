import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { RideStatus, VehicleType } from "@prisma/client";

// --- Update Driver Location & Status ---
export const updateLocationStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string };
    if (!user || user.role !== "DRIVER") {
      return res.status(401).json({ error: "Not authorized" });
    }
    const { lat, lng, online } = req.body;
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof online !== "boolean"
    ) {
      return res.status(400).json({ error: "Missing or invalid lat, lng, or online status" });
    }
    // Also update lastKnownLat/lastKnownLng for proximity checks
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lat, lng, online,
        lastKnownLat: lat,
        lastKnownLng: lng,
        lastLocationAt: new Date(),
      },
    });
    res.json({ message: "Location and status updated." });
  } catch (error) {
    next(error);
  }
};

// --- Get Available Rides (Scheduled & Regular) ---
export const getAvailableRides = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string; vehicleType?: string };
    const driverId = user?.id;

    // Safely extract vehicleType as string
    const vehicleTypeRaw = user?.vehicleType ?? req.query.vehicleType;
    let vehicleType: string | undefined;

    if (typeof vehicleTypeRaw === "string") {
      vehicleType = vehicleTypeRaw;
    } else if (Array.isArray(vehicleTypeRaw) && typeof vehicleTypeRaw[0] === "string") {
      vehicleType = vehicleTypeRaw[0];
    } else {
      vehicleType = undefined;
    }

    const vehicleTypeUpper = vehicleType ? vehicleType.toUpperCase() : undefined;

    const now = new Date();
    const thirtyMinFromNow = new Date(now.getTime() + 30 * 60 * 1000);

    let rideTypes: VehicleType[] = [];
    if (vehicleTypeUpper === "TOW_TRUCK") {
      rideTypes = ["TOW_TRUCK", "TRUCK"];
    } else if (vehicleTypeUpper === "WHEELCHAIR") {
      rideTypes = ["WHEELCHAIR", "CAR", "DELIVERY", "TUKTUK"];
    } else if (vehicleTypeUpper === "CAR" || vehicleTypeUpper === "TUKTUK") {
      rideTypes = [vehicleTypeUpper as VehicleType, "DELIVERY"];
    } else if (vehicleTypeUpper) {
      rideTypes = [vehicleTypeUpper as VehicleType];
    }

    const rides = await prisma.ride.findMany({
      where: {
        OR: [
          {
            status: RideStatus.SCHEDULED,
            scheduledAt: { lte: thirtyMinFromNow },
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
      include: {
        customer: { select: { id: true, name: true } }
      },
      orderBy: { scheduledAt: "asc" }
    });

    res.json(rides);
  } catch (error) {
    next(error);
  }
};

// --- Accept a Ride (Scheduled or Regular) ---
export const acceptRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string };
    const driverId = user?.id;
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

    res.json(updatedRide);
  } catch (error) {
    next(error);
  }
};

// --- Start Ride ---
export const startRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string };
    const driverId = user?.id;
    const rideId = Number(req.params.rideId);

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
      ride: updated,
    });
  } catch (error) {
    next(error);
  }
};

// --- Mark Any Ride as "No Show" with Proximity Check and Automated Chat Message ---
export const markRideNoShow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string };
    const driverId = user?.id;
    const rideId = Number(req.params.rideId);

    // Fetch ride, customer, and pickup coordinates
    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      include: { customer: true, driver: true, chat: true }
    });
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    // Get driver's last known location
    const driver = await prisma.user.findUnique({ where: { id: driverId } });
    if (!driver || typeof driver.lastKnownLat !== "number" || typeof driver.lastKnownLng !== "number") {
      return res.status(400).json({ error: "Driver location unavailable" });
    }

    // Calculate distance (Haversine formula)
    function toRad(v: number) { return (v * Math.PI) / 180; }
    function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
      const R = 6371000;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
          Math.cos(toRad(lat2)) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    const dist = getDistanceMeters(
      driver.lastKnownLat,
      driver.lastKnownLng,
      ride.originLat,
      ride.originLng
    );
    if (dist > 25) {
      return res.status(400).json({ error: "You must be within 25 meters of the pickup location to mark No Show." });
    }

    // Mark ride as NO_SHOW
    const updated = await prisma.ride.update({
      where: { id: rideId },
      data: { status: RideStatus.NO_SHOW, noShowReportedAt: new Date() },
    });

    // Send automated chat message to customer if chat exists
    if (ride.chat) {
      await prisma.message.create({
        data: {
          chatId: ride.chat.id,
          senderId: driverId,
          content: "I m at your requested pickup location but couldn't find you, if you are available kindly reply, I will leave in 5 minutes from now, Thank You.",
          sentAt: new Date(),
        }
      });
    }

    res.json({ message: "Ride marked as No Show", ride: updated });
  } catch (error) {
    next(error);
  }
};

// --- Get Current Ride for Driver ---
export const getCurrentRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as { id: number; role: string };
    if (!user) return res.status(401).json({ error: "Not authenticated" });
    const role = user.role?.toLowerCase();
    let where: any = {};
    if (role === "driver") {
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
          }
        : undefined,
      customer: ride.customer
        ? {
            id: ride.customer.id,
            name: ride.customer.name,
          }
        : undefined,
      scheduledAt: ride.scheduledAt,
      destLat: ride.destLat,
      destLng: ride.destLng,
      acceptedAt: ride.acceptedAt,
    });
  } catch (error) {
    next(error);
  }
};
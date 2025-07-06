import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { VehicleType, RideStatus } from "@prisma/client";

// Helper to normalize and validate vehicleType input (case-insensitive)
function normalizeVehicleType(input: any): VehicleType | undefined {
  if (!input || typeof input !== "string") return undefined;
  const upper = input.trim().toUpperCase();
  if (Object.values(VehicleType).includes(upper as VehicleType)) {
    return upper as VehicleType;
  }
  return undefined;
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
      ],
    },
  });
  return !!busyRide;
}

// Customer requests a ride with vehicle type and location
export const requestRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      customerId,
      originLat,
      originLng,
      destLat,
      destLng,
      vehicleType,
    } = req.body;

    const normalizedVehicleType = normalizeVehicleType(vehicleType);

    // Ensure customerId is an integer and not a string/UUID
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

    const ride = await prisma.ride.create({
      data: {
        customer: { connect: { id: numericCustomerId } },
        status: RideStatus.PENDING,
        originLat,
        originLng,
        destLat,
        destLng,
        vehicleType: normalizedVehicleType,
      },
    });

    res.json({
      rideId: ride.id,
      status: ride.status,
    });
  } catch (error) {
    console.error("Error creating ride:", error);
    next(error);
  }
};

// Get available rides for drivers (pending status, for their vehicle type or delivery)
export const getAvailableRides = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Accept driverId as a query param for development
    const driverId = Number(req.query.driverId);
    if (!driverId) {
      return res.status(401).json({ error: "Unauthorized: Missing driver id" });
    }

    // Find driver's vehicle type
    const driver = await prisma.user.findUnique({
      where: { id: driverId },
      select: { vehicleType: true },
    });
    if (!driver) {
      return res.status(404).json({ error: "Driver not found" });
    }

    // Logic: Car and Tuktuk drivers also see DELIVERY rides
    let rideTypes: VehicleType[] = [];
    if (driver.vehicleType === "CAR" || driver.vehicleType === "TUKTUK") {
      rideTypes = [driver.vehicleType, "DELIVERY"];
    } else if (driver.vehicleType) {
      rideTypes = [driver.vehicleType];
    }

    const where: any = {
      status: RideStatus.PENDING,
      driverId: null,
    };
    if (rideTypes.length > 0) {
      where.vehicleType = { in: rideTypes };
    }

    const rides = await prisma.ride.findMany({
      where,
      select: {
        id: true,
        originLat: true,
        originLng: true,
        vehicleType: true,
        customer: { select: { name: true } },
      },
    });

    // Map fields for frontend compatibility
    const mappedRides = rides.map(ride => ({
      id: ride.id,
      pickupLat: ride.originLat,
      pickupLng: ride.originLng,
      customerName: ride.customer?.name || "",
      vehicleType: ride.vehicleType,
    }));

    // Debug log to see what rides are being returned
    console.log("Available rides found:", mappedRides);

    res.json(mappedRides);
  } catch (error) {
    console.error("Error fetching available rides:", error);
    next(error);
  }
};

// Driver accepts a ride
export const acceptRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Accept driverId as a query param for development
    const driverId = Number(req.query.driverId);
    if (!driverId) {
      return res.status(401).json({ error: "Unauthorized: Missing driver id" });
    }

    // Check if driver is already busy (accepted/in_progress) in the last 15 minutes
    const busy = await isDriverBusy(driverId);
    if (busy) {
      return res.status(400).json({ error: "You already have an active or recent job. Finish it or wait 15 minutes before accepting a new one." });
    }

    // Make sure to convert rideId to a number!
    const rideId = Number(req.params.rideId);

    // Only allow accepting if ride is still pending and unassigned
    const ride = await prisma.ride.updateMany({
      where: { id: rideId, status: RideStatus.PENDING, driverId: null },
      data: { status: RideStatus.ACCEPTED, driverId, acceptedAt: new Date() },
    });

    if (ride.count === 0) {
      return res.status(400).json({ error: "Ride already assigned or not available." });
    }

    // Mark the driver as busy
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
    console.error("Error accepting ride:", error);
    next(error);
  }
};

// Driver starts a ride (NEW ENDPOINT FOR IN_PROGRESS STATUS)
export const startRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const driverId = Number(req.query.driverId);
    const rideId = Number(req.params.rideId);

    if (!driverId || !rideId) {
      return res.status(400).json({ error: "Invalid driverId or rideId" });
    }

    // Only allow starting a ride if it is accepted by this driver
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

    return res.json({
      status: "in_progress",
      ride: updated,
    });
  } catch (error) {
    console.error("Error starting ride:", error);
    next(error);
  }
};

// Get ride status for polling (UPDATED)
export const getRideStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rideId = Number(req.params.rideId);
    if (!rideId) {
      return res.status(400).json({ error: "Invalid rideId" });
    }

    const ride = await prisma.ride.findUnique({
      where: { id: rideId },
      select: { status: true }
    });

    if (!ride) {
      return res.status(404).json({ error: "Ride not found" });
    }

    // Map DB enum to user-friendly lowercase status for frontend
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
      default:
        statusForFrontend = String(ride.status || "unknown").toLowerCase();
    }

    return res.json({ status: statusForFrontend });
  } catch (error) {
    console.error("Error fetching ride status:", error);
    next(error);
  }
};

// --- NEW: Customer rates a ride ---
export const rateRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rideId = Number(req.params.rideId);
    const { rating, feedback } = req.body;

    if (!rideId || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Invalid rideId or rating (must be 1-5)" });
    }

    // Only allow rating a completed ride, and only if not rated yet
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

// --- GET CURRENT RIDE FOR CUSTOMER/DRIVER (FIXED ROLE CHECK) ---
export const getCurrentRide = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Assumes authentication middleware sets req.user and req.user.role
    // Accepts both customer and driver
    const user = req.user as { id: number; role: string };
    if (!user) return res.status(401).json({ error: "Not authenticated" });

    // Accept "customer", "CUSTOMER", "driver", "DRIVER" etc.
    const role = user.role?.toLowerCase();
    let where: any = {};
    if (role === "customer") {
      where = {
        customerId: user.id,
        status: { in: [RideStatus.PENDING, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] },
      };
    } else if (role === "driver") {
      where = {
        driverId: user.id,
        status: { in: [RideStatus.PENDING, RideStatus.ACCEPTED, RideStatus.IN_PROGRESS] },
      };
    } else {
      return res.status(400).json({ error: "Invalid user role" });
    }

    // Always include both customer and driver for correct TypeScript inference
    const ride = await prisma.ride.findFirst({
      where,
      include: {
        driver: true,
        customer: true,
      }
    });

    if (!ride) return res.status(404).json({ error: "No active ride" });

    // Normalize vehicleType and user names for frontend
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
    });
  } catch (error) {
    console.error("Error fetching current ride:", error);
    next(error);
  }
};

// --- Mark ride as done (completed) ---
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
      completedAt: ride.completedAt,
      customer: ride.customer ? { id: ride.customer.id, name: ride.customer.name } : undefined,
      driver: ride.driver ? { id: ride.driver.id, name: ride.driver.name } : undefined,
    });
  } catch (error) {
    console.error("Error marking ride as done:", error);
    next(error);
  }
};

// --- Cancel a ride ---
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
      cancelledAt: ride.cancelledAt,
      customer: ride.customer ? { id: ride.customer.id, name: ride.customer.name } : undefined,
      driver: ride.driver ? { id: ride.driver.id, name: ride.driver.name } : undefined,
    });
  } catch (error) {
    console.error("Error cancelling ride:", error);
    next(error);
  }
};
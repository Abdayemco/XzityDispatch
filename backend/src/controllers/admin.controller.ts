import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { RideStatus } from "@prisma/client";
import { DateTime } from "luxon";
import fetch from "node-fetch";

// Helper: Get timezone from lat/lng using TimeZoneDB
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

// Converts an ISO string or Date in UTC to a formatted string in the destination time zone.
function utcToLocal(
  utcISO: string | Date,
  zone: string,
  format = "yyyy-MM-dd HH:mm"
): string {
  return DateTime.fromISO(
    typeof utcISO === "string" ? utcISO : utcISO.toISOString(),
    { zone: "utc" }
  )
    .setZone(zone)
    .toFormat(format);
}

// --- Rides endpoint (sortable, paginated, scheduled rides show first, with local time zone!) ---
export const getRides = async (req: Request, res: Response) => {
  try {
    const allowedFields = ["id", "requestedAt", "scheduledAt"];
    const sortBy = allowedFields.includes(req.query.sortBy as string) ? req.query.sortBy as string : "requestedAt";
    const order = (req.query.order === "asc" || req.query.order === "desc") ? req.query.order : "desc";
    const take = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
    const skip = Math.max(0, Number(req.query.offset) || 0);

    const rides = await prisma.ride.findMany({
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        driver: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: [
        { status: "asc" },
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
        return {
          ...ride,
          scheduledAtLocal: ride.scheduledAt
            ? utcToLocal(ride.scheduledAt.toISOString(), localTimeZone)
            : null,
          requestedAtLocal: ride.requestedAt
            ? utcToLocal(ride.requestedAt.toISOString(), localTimeZone)
            : null,
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
    res.json({
      ...scheduledRide,
      scheduledAtLocal: scheduledRide.scheduledAt
        ? utcToLocal(scheduledRide.scheduledAt.toISOString(), localTimeZone)
        : null,
      pickupTimeZone: localTimeZone
    });
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
    res.json({
      ...scheduledRide,
      scheduledAtLocal: scheduledRide.scheduledAt
        ? utcToLocal(scheduledRide.scheduledAt.toISOString(), localTimeZone)
        : null,
      pickupTimeZone: localTimeZone
    });
  } catch (error) {
    next(error);
  }
};

// --- NO SHOW COUNTS FOR CUSTOMER/DRIVER (unchanged) ---
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
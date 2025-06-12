"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestRide = exports.acceptRide = exports.getAvailableRides = void 0;
const prisma_1 = require("../utils/prisma");
const client_1 = require("@prisma/client");
// Get available rides for drivers (pending status, for their vehicle type)
const getAvailableRides = async (req, res) => {
    try {
        const driverId = req.user?.id;
        if (!driverId) {
            return res.status(401).json({ error: "Unauthorized: Missing driver id" });
        }
        // Find driver's vehicle type
        const driver = await prisma_1.prisma.user.findUnique({
            where: { id: driverId },
            select: { vehicleType: true },
        });
        if (!driver) {
            return res.status(404).json({ error: "Driver not found" });
        }
        // Only show rides for this vehicle type (if set) and not yet assigned to any driver
        const where = {
            status: client_1.RideStatus.PENDING,
            driverId: null
        };
        if (driver.vehicleType) {
            where.vehicleType = driver.vehicleType;
        }
        const rides = await prisma_1.prisma.ride.findMany({
            where,
            select: {
                id: true,
                originLat: true,
                originLng: true,
                destLat: true,
                destLng: true,
                requestedAt: true,
                customer: { select: { name: true, phone: true } },
            },
        });
        res.json(rides);
    }
    catch (error) {
        console.error("Error fetching available rides:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.getAvailableRides = getAvailableRides;
// Driver accepts a ride
const acceptRide = async (req, res) => {
    try {
        const { rideId } = req.params;
        const driverId = req.user?.id; // Should be set by auth middleware
        if (!driverId) {
            return res.status(401).json({ error: "Unauthorized: Missing driver id" });
        }
        // Only allow accepting if ride is still pending and unassigned
        const ride = await prisma_1.prisma.ride.updateMany({
            where: { id: rideId, status: client_1.RideStatus.PENDING, driverId: null },
            data: { status: client_1.RideStatus.ACCEPTED, driverId, acceptedAt: new Date() },
        });
        if (ride.count === 0) {
            return res.status(400).json({ error: "Ride already assigned or not available." });
        }
        // Mark the driver as busy
        await prisma_1.prisma.user.update({
            where: { id: driverId },
            data: { isBusy: true },
        });
        const updatedRide = await prisma_1.prisma.ride.findUnique({
            where: { id: rideId },
            include: { customer: true, driver: true }
        });
        res.json(updatedRide);
    }
    catch (error) {
        console.error("Error accepting ride:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.acceptRide = acceptRide;
// Customer requests a ride with vehicle type and location
const requestRide = async (req, res) => {
    try {
        const { customerId, originLat, originLng, destLat, destLng, vehicleType, } = req.body;
        if (!customerId ||
            typeof originLat !== "number" ||
            typeof originLng !== "number" ||
            typeof destLat !== "number" ||
            typeof destLng !== "number" ||
            !vehicleType) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        // 1. Check if there are any available drivers of correct vehicle type
        const drivers = await prisma_1.prisma.user.findMany({
            where: {
                role: client_1.Role.DRIVER,
                vehicleType: vehicleType,
                isAvailable: true,
                isBusy: false,
                lat: { not: null },
                lng: { not: null },
            },
        });
        if (!drivers.length) {
            return res.status(404).json({ error: "No available drivers for this vehicle type." });
        }
        // 2. Create the ride without assigning a driver yet (driver will accept)
        const ride = await prisma_1.prisma.ride.create({
            data: {
                customer: { connect: { id: customerId } },
                status: client_1.RideStatus.PENDING,
                originLat,
                originLng,
                destLat,
                destLng,
                vehicleType: vehicleType,
            },
        });
        // 3. Respond to customer with ride info
        res.json({
            rideId: ride.id,
            status: ride.status,
        });
    }
    catch (error) {
        console.error("Error creating ride:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
exports.requestRide = requestRide;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../utils/prisma"); // adjust import path as needed
const router = (0, express_1.Router)();
// GET /api/rides/available?vehicleType=car
router.get('/available', async (req, res) => {
    const { vehicleType } = req.query;
    try {
        // Only return rides that are pending, unassigned, and match the requested vehicle type
        const rides = await prisma_1.prisma.ride.findMany({
            where: {
                status: 'PENDING',
                driverId: null,
                // Prisma enums must match the enum type exactly
                vehicleType: vehicleType.toUpperCase(), // 'CAR', 'BIKE', etc.
            },
            select: {
                id: true,
                originLat: true,
                originLng: true,
                vehicleType: true,
                status: true,
                driverId: true,
                customer: { select: { name: true } }, // <--- fix: select related customer name!
            }
        });
        // Map data to frontend format
        const jobs = rides.map(ride => ({
            id: ride.id,
            pickupLat: ride.originLat,
            pickupLng: ride.originLng,
            customerName: ride.customer?.name ?? 'Unknown',
            vehicleType: ride.vehicleType.toLowerCase(), // e.g. car, bike, ...
            status: ride.status.toLowerCase(),
            assignedDriverId: ride.driverId,
        }));
        res.json(jobs);
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to fetch rides' });
    }
});
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_1 = require("../utils/prisma");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router.post("/reset", async (req, res) => {
    try {
        // Reset all rides to COMPLETED and unassign drivers
        await prisma_1.prisma.ride.updateMany({
            data: { status: client_1.RideStatus.COMPLETED, driverId: null },
            where: {}, // all rides
        });
        // Mark all drivers as not busy
        await prisma_1.prisma.user.updateMany({
            data: { isBusy: false },
            where: { role: client_1.Role.DRIVER },
        });
        res.json({ message: "All rides reset and drivers marked as not busy." });
    }
    catch (error) {
        console.error("Error resetting rides:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;

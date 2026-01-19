import express from "express";
import { PrismaClient } from "@prisma/client";
import { isAdmin } from "../middlewares/isAdmin";

const prisma = new PrismaClient();
const router = express.Router();

// Protect all job routes with isAdmin middleware
router.use(isAdmin);

// GET all jobs (rides with jobDetails) + optionally filter by category/subType
router.get("/", async (req, res, next) => {
  try {
    const { categoryId, subTypeId } = req.query;

    const where: any = {};
    if (categoryId) where.serviceCategoryId = Number(categoryId);
    if (subTypeId) where.serviceSubTypeId = Number(subTypeId);

    const jobs = await prisma.ride.findMany({
      where,
      orderBy: { id: "asc" },
      include: {
        customer: true,
        driver: true,
        serviceCategory: true,
        serviceSubType: true,
      },
    });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
});

// GET one job by ID
router.get("/:id", async (req, res, next) => {
  try {
    const job = await prisma.ride.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        customer: true,
        driver: true,
        serviceCategory: true,
        serviceSubType: true,
      },
    });
    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
});

// CREATE a new job (ride)
router.post("/", async (req, res, next) => {
  try {
    const {
      customerId,
      driverId,
      originLat,
      originLng,
      destLat,
      destLng,
      vehicleType,
      serviceCategoryId,
      serviceSubTypeId,
      status,
      requestedAt,
      scheduledAt,
      note,
      jobDetails,
      subType,
      destinationName,
      categoryName // <--- Accept from client
    } = req.body;

    // You can adjust required fields as needed
    if (
      !customerId ||
      !vehicleType ||
      !serviceCategoryId ||
      !serviceSubTypeId ||
      !categoryName
    ) {
      return res
        .status(400)
        .json({ error: "customerId, vehicleType, serviceCategoryId, serviceSubTypeId, categoryName are required" });
    }

    const job = await prisma.ride.create({
      data: {
        customerId: Number(customerId),
        driverId: driverId ? Number(driverId) : undefined,
        originLat,
        originLng,
        destLat,
        destLng,
        vehicleType,
        serviceCategoryId: Number(serviceCategoryId),
        serviceSubTypeId: Number(serviceSubTypeId),
        status: status || "PENDING",
        requestedAt: requestedAt ? new Date(requestedAt) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        note,
        jobDetails,
        subType,
        destinationName,
        categoryName: String(categoryName).trim(), // 🟢 Add required field
      }
    });

    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
});

// UPDATE a job (ride)
router.put("/:id", async (req, res, next) => {
  try {
    const {
      customerId,
      driverId,
      originLat,
      originLng,
      destLat,
      destLng,
      vehicleType,
      serviceCategoryId,
      serviceSubTypeId,
      status,
      requestedAt,
      scheduledAt,
      note,
      jobDetails,
      subType,
      destinationName,
      categoryName // <--- Accept from client
    } = req.body;

    const job = await prisma.ride.update({
      where: { id: Number(req.params.id) },
      data: {
        customerId: customerId ? Number(customerId) : undefined,
        driverId: driverId ? Number(driverId) : undefined,
        originLat,
        originLng,
        destLat,
        destLng,
        vehicleType,
        serviceCategoryId: serviceCategoryId ? Number(serviceCategoryId) : undefined,
        serviceSubTypeId: serviceSubTypeId ? Number(serviceSubTypeId) : undefined,
        status,
        requestedAt: requestedAt ? new Date(requestedAt) : undefined,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
        note,
        jobDetails,
        subType,
        destinationName,
        categoryName: categoryName ? String(categoryName).trim() : undefined, // 🟢 Add required field
      }
    });

    res.json(job);
  } catch (err) {
    next(err);
  }
});

// DELETE a job (ride)
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.ride.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
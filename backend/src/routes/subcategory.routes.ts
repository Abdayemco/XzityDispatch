import express from "express";
import { PrismaClient, Role } from "@prisma/client";
import { isAdmin } from "../middlewares/isAdmin";

const prisma = new PrismaClient();
const router = express.Router();

// Require admin for all subcategory operations
router.use(isAdmin);

// GET all subcategories (optionally filter by categoryId, includes icon & acceptedRoles)
router.get("/", async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    const where = categoryId ? { categoryId: Number(categoryId) } : {};
    const subTypes = await prisma.serviceSubType.findMany({
      where,
      include: { acceptedRoles: true },
      orderBy: { id: "asc" },
    });
    const mapped = subTypes.map(sub => ({
      ...sub,
      acceptedRoles: sub.acceptedRoles.map(r => r.role)
    }));
    res.json(mapped);
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

// GET a single subcategory by ID
router.get("/:id", async (req, res, next) => {
  try {
    const subType = await prisma.serviceSubType.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: true, rides: true, acceptedRoles: true },
    });
    if (!subType) return res.status(404).json({ error: "Subcategory not found" });
    const mapped = {
      ...subType,
      acceptedRoles: subType.acceptedRoles.map(r => r.role)
    };
    res.json(mapped);
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

// CREATE a new subcategory
router.post("/", async (req, res, next) => {
  try {
    const { name, icon, categoryId, acceptedRoles } = req.body;
    if (!name || typeof name !== "string" || !categoryId) {
      return res.status(400).json({ error: "Name and categoryId are required" });
    }
    // Avoid duplicate subType in same category
    const existing = await prisma.serviceSubType.findFirst({
      where: { name, categoryId: Number(categoryId) }
    });
    if (existing) {
      return res.status(409).json({ error: "Subcategory already exists in this category." });
    }
    const subType = await prisma.serviceSubType.create({
      data: { name, icon, categoryId: Number(categoryId) },
    });
    // Add acceptedRoles (join table)
    if (acceptedRoles && Array.isArray(acceptedRoles)) {
      await prisma.$transaction(
        acceptedRoles.map(role =>
          prisma.serviceSubTypeRole.create({
            data: {
              subTypeId: subType.id,
              role: role as Role,
            }
          })
        )
      );
    }
    const result = await prisma.serviceSubType.findUnique({
      where: { id: subType.id },
      include: { acceptedRoles: true }
    });
    if (!result) {
      return res.status(404).json({ error: "Subcategory not found after creation." });
    }
    res.status(201).json({
      ...result,
      acceptedRoles: result.acceptedRoles.map(r => r.role)
    });
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

// UPDATE a subcategory
router.put("/:id", async (req, res, next) => {
  try {
    const { name, icon, categoryId, acceptedRoles } = req.body;
    if (!name || typeof name !== "string" || !categoryId) {
      return res.status(400).json({ error: "Name and categoryId are required" });
    }
    const subType = await prisma.serviceSubType.update({
      where: { id: Number(req.params.id) },
      data: { name, icon, categoryId: Number(categoryId) },
    });
    // Update acceptedRoles - remove old, add new
    if (acceptedRoles && Array.isArray(acceptedRoles)) {
      await prisma.serviceSubTypeRole.deleteMany({
        where: { subTypeId: subType.id }
      });
      await prisma.$transaction(
        acceptedRoles.map(role =>
          prisma.serviceSubTypeRole.create({
            data: {
              subTypeId: subType.id,
              role: role as Role,
            }
          })
        )
      );
    }
    const result = await prisma.serviceSubType.findUnique({
      where: { id: subType.id },
      include: { acceptedRoles: true }
    });
    if (!result) {
      return res.status(404).json({ error: "Subcategory not found after update." });
    }
    res.json({
      ...result,
      acceptedRoles: result.acceptedRoles.map(r => r.role)
    });
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

// DELETE a subcategory (safe: also deletes its roles, blocks if rides exist)
router.delete("/:id", async (req, res, next) => {
  try {
    const subTypeId = Number(req.params.id);
    // Prevent delete if rides exist for this subType
    const subTypeObj = await prisma.serviceSubType.findUnique({ where: { id: subTypeId } });
    if (!subTypeObj)
      return res.status(404).json({ error: "Subcategory not found" });
    const rideCount = await prisma.ride.count({ where: { subType: subTypeObj.name } });
    if (rideCount > 0) {
      return res.status(400).json({ error: "Cannot delete subcategory: It is in use by existing rides." });
    }
    await prisma.serviceSubTypeRole.deleteMany({
      where: { subTypeId }
    });
    await prisma.serviceSubType.delete({
      where: { id: subTypeId },
    });
    res.json({ success: true });
  } catch (err) {
    next(err instanceof Error ? err : new Error(String(err)));
  }
});

export default router;
import express from "express";
import { PrismaClient, Role } from "@prisma/client";
import { isAdmin } from "../middlewares/isAdmin";

const prisma = new PrismaClient();
const router = express.Router();

router.use(isAdmin);

// GET all subcategories (optionally filter by categoryId, includes icon & acceptedRoles)
router.get("/", async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    let where = {};
    if (categoryId) where = { categoryId: Number(categoryId) };
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
    next(err);
  }
});

// GET a single subcategory by ID (include icon & acceptedRoles)
router.get("/:id", async (req, res, next) => {
  try {
    const subType = await prisma.serviceSubType.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: true, rides: true, acceptedRoles: true },
    });
    if (!subType) {
      return res.status(404).json({ error: "Subcategory not found" });
    }
    const mapped = {
      ...subType,
      acceptedRoles: subType.acceptedRoles.map(r => r.role)
    };
    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// CREATE a new subcategory (accept icon & acceptedRoles)
router.post("/", async (req, res, next) => {
  try {
    const { name, icon, categoryId, acceptedRoles } = req.body;
    if (!name || typeof name !== "string" || !categoryId) {
      return res.status(400).json({ error: "Name and categoryId are required" });
    }
    // Create subType
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
    res.status(201).json({
      ...result,
      acceptedRoles: result.acceptedRoles.map(r => r.role)
    });
  } catch (err) {
    next(err);
  }
});

// UPDATE a subcategory (accept icon & acceptedRoles)
router.put("/:id", async (req, res, next) => {
  try {
    const { name, icon, categoryId, acceptedRoles } = req.body;
    if (!name || typeof name !== "string" || !categoryId) {
      return res.status(400).json({ error: "Name and categoryId are required" });
    }
    // Update subType
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
    res.json({
      ...result,
      acceptedRoles: result.acceptedRoles.map(r => r.role)
    });
  } catch (err) {
    next(err);
  }
});

// DELETE a subcategory
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.serviceSubTypeRole.deleteMany({
      where: { subTypeId: Number(req.params.id) }
    });
    await prisma.serviceSubType.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
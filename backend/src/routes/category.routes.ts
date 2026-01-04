import express from "express";
import { PrismaClient } from "@prisma/client";
import { isAdmin } from "../middlewares/isAdmin";

const prisma = new PrismaClient();
const router = express.Router();

router.use(isAdmin);

// GET all categories (with subTypes and icon)
router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      include: {
        subTypes: {
          include: {
            acceptedRoles: true
          }
        },
      },
      orderBy: { id: "asc" },
    });

    // Map subTypes' acceptedRoles arrays to just the enums
    const mapped = categories.map(cat => ({
      ...cat,
      subTypes: cat.subTypes.map(sub => ({
        ...sub,
        acceptedRoles: sub.acceptedRoles.map(roleObj => roleObj.role)
      }))
    }));

    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// GET single category by ID (with subTypes and icon)
router.get("/:id", async (req, res, next) => {
  try {
    const category = await prisma.serviceCategory.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        subTypes: {
          include: {
            acceptedRoles: true
          }
        }
      },
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    const mapped = {
      ...category,
      subTypes: category.subTypes.map(sub => ({
        ...sub,
        acceptedRoles: sub.acceptedRoles.map(roleObj => roleObj.role)
      }))
    };
    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

// CREATE new category (now supports icon)
router.post("/", async (req, res, next) => {
  try {
    const { name, icon } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }
    const category = await prisma.serviceCategory.create({
      data: { name, icon },
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// UPDATE a category (now supports icon)
router.put("/:id", async (req, res, next) => {
  try {
    const { name, icon } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }
    const category = await prisma.serviceCategory.update({
      where: { id: Number(req.params.id) },
      data: { name, icon },
    });
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// DELETE a category
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.serviceCategory.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
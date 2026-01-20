import express from "express";
import { PrismaClient } from "@prisma/client";
import { isAdmin } from "../middlewares/isAdmin";

const prisma = new PrismaClient();
const router = express.Router();

// 🟢 GET all categories (with subTypes and icon) - open to all
router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      include: {
        subTypes: {
          include: {
            acceptedRoles: true,
          },
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

// 🟢 GET single category by ID (open to all)
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

// 🛡️ CREATE new category (admin only)
router.post("/", isAdmin, async (req, res, next) => {
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
    // Unique constraint error
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Category already exists." });
    }
    next(err);
  }
});

// 🛡️ UPDATE a category (admin only)
router.put("/:id", isAdmin, async (req, res, next) => {
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

// 🛡️ DELETE a category (admin only)
router.delete("/:id", isAdmin, async (req, res, next) => {
  try {
    await prisma.serviceCategory.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true });
  } catch (err) {
    // Foreign key constraint error handling (category in use)
    if (err.code === "P2003") {
      return res.status(400).json({ error: "Cannot delete category: It is in use by rides or subtypes." });
    }
    next(err);
  }
});

export default router;
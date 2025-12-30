import express from "express";
import { PrismaClient } from "@prisma/client";
import { isAdmin } from "../middlewares/isAdmin";

const prisma = new PrismaClient();
const router = express.Router();

// Protect all subcategory routes with isAdmin middleware
router.use(isAdmin);

// GET all subcategories (optionally filter by categoryId)
router.get("/", async (req, res, next) => {
  try {
    const { categoryId } = req.query;
    let subTypes = [];
    if (categoryId) {
      subTypes = await prisma.serviceSubType.findMany({
        where: { categoryId: Number(categoryId) },
        orderBy: { id: "asc" },
      });
    } else {
      subTypes = await prisma.serviceSubType.findMany({ orderBy: { id: "asc" } });
    }
    res.json(subTypes);
  } catch (err) {
    next(err);
  }
});

// GET a single subcategory by ID
router.get("/:id", async (req, res, next) => {
  try {
    const subType = await prisma.serviceSubType.findUnique({
      where: { id: Number(req.params.id) },
      include: { category: true, rides: true },
    });
    if (!subType) {
      return res.status(404).json({ error: "Subcategory not found" });
    }
    res.json(subType);
  } catch (err) {
    next(err);
  }
});

// CREATE a new subcategory
router.post("/", async (req, res, next) => {
  try {
    const { name, categoryId } = req.body;
    if (!name || typeof name !== "string" || !categoryId) {
      return res.status(400).json({ error: "Name and categoryId are required" });
    }
    const subType = await prisma.serviceSubType.create({
      data: {
        name,
        categoryId: Number(categoryId),
      },
    });
    res.status(201).json(subType);
  } catch (err) {
    next(err);
  }
});

// UPDATE a subcategory
router.put("/:id", async (req, res, next) => {
  try {
    const { name, categoryId } = req.body;
    if (!name || typeof name !== "string" || !categoryId) {
      return res.status(400).json({ error: "Name and categoryId are required" });
    }
    const subType = await prisma.serviceSubType.update({
      where: { id: Number(req.params.id) },
      data: {
        name,
        categoryId: Number(categoryId),
      },
    });
    res.json(subType);
  } catch (err) {
    next(err);
  }
});

// DELETE a subcategory
router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.serviceSubType.delete({
      where: { id: Number(req.params.id) },
    });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
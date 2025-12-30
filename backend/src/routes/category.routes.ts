import express from "express";
import { PrismaClient } from "@prisma/client";
import { isAdmin } from "../middlewares/isAdmin";

const prisma = new PrismaClient();
const router = express.Router();

// Protect all category routes with isAdmin middleware
router.use(isAdmin);

// GET all categories (with subTypes)
router.get("/", async (req, res, next) => {
  try {
    const categories = await prisma.serviceCategory.findMany({
      include: { subTypes: true },
      orderBy: { id: "asc" },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// GET single category by ID (with subTypes)
router.get("/:id", async (req, res, next) => {
  try {
    const category = await prisma.serviceCategory.findUnique({
      where: { id: Number(req.params.id) },
      include: { subTypes: true },
    });
    if (!category) {
      return res.status(404).json({ error: "Category not found" });
    }
    res.json(category);
  } catch (err) {
    next(err);
  }
});

// CREATE new category
router.post("/", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }
    const category = await prisma.serviceCategory.create({
      data: { name },
    });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// UPDATE a category
router.put("/:id", async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "Name is required" });
    }
    const category = await prisma.serviceCategory.update({
      where: { id: Number(req.params.id) },
      data: { name },
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
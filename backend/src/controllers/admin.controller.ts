import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import { RideStatus } from "@prisma/client";

// --- DRIVERS ---
export const getDrivers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const drivers = await prisma.user.findMany({
      where: { 
        role: "DRIVER", 
        online: true, 
        lat: { not: null },
        lng: { not: null }
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        lat: true,
        lng: true,
        online: true,
        trialStart: true,
        trialEnd: true,
        subscriptionStatus: true,
        subscriptionFee: true,
        paymentMethod: true,
        isSubscriptionDisabled: true,
        disabled: true,
      },
      orderBy: { id: "desc" },
    });
    res.json(drivers);
  } catch (error) {
    next(error);
  }
};

export const getDriver = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const driver = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        lat: true,
        lng: true,
        online: true,
        trialStart: true,
        trialEnd: true,
        subscriptionStatus: true,
        subscriptionFee: true,
        paymentMethod: true,
        isSubscriptionDisabled: true,
        disabled: true,
      },
    });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    res.json(driver);
  } catch (error) {
    next(error);
  }
};

export const updateDriverSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const {
      trialStart,
      trialEnd,
      subscriptionStatus,
      subscriptionFee,
      paymentMethod,
      isSubscriptionDisabled,
      disabled,
      lat,
      lng,
      online
    } = req.body;

    const driver = await prisma.user.findUnique({ where: { id } });
    if (!driver) return res.status(404).json({ error: "Driver not found" });
    if (driver.role !== "DRIVER") return res.status(400).json({ error: "Not a driver" });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        trialStart,
        trialEnd,
        subscriptionStatus,
        subscriptionFee,
        paymentMethod,
        isSubscriptionDisabled,
        disabled,
        lat,
        lng,
        online
      },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        lat: true,
        lng: true,
        online: true,
        trialStart: true,
        trialEnd: true,
        subscriptionStatus: true,
        subscriptionFee: true,
        paymentMethod: true,
        isSubscriptionDisabled: true,
        disabled: true,
      }
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// --- CUSTOMERS ---
export const getCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customers = await prisma.user.findMany({
      where: { role: "CUSTOMER" },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        disabled: true,
      },
      orderBy: { id: "desc" },
    });
    res.json(customers);
  } catch (error) {
    next(error);
  }
};

export const blockCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const { disabled } = req.body;
    const customer = await prisma.user.findUnique({ where: { id } });
    if (!customer) return res.status(404).json({ error: "Customer not found" });
    if (customer.role !== "CUSTOMER") return res.status(400).json({ error: "Not a customer" });

    const updated = await prisma.user.update({
      where: { id },
      data: { disabled: !!disabled },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        avatar: true,
        disabled: true,
      },
    });
    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// --- RIDES ---
export const getRides = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get status param (e.g., "live", "not_done")
    const statusParam = (req.query.status as string)?.toLowerCase();
    let statusFilter = undefined;

    // Define "live" statuses using enum
    const liveStatuses: RideStatus[] = [
      RideStatus.ACCEPTED,
      RideStatus.IN_PROGRESS
    ];
    const notDoneStatuses: RideStatus[] = [
      RideStatus.COMPLETED,
      RideStatus.CANCELLED
    ];

    if (statusParam === "live") {
      statusFilter = { status: { in: liveStatuses } };
    } else if (statusParam === "not_done") {
      statusFilter = { status: { notIn: notDoneStatuses } };
    }
    // Default: show all (no filter) if not specified

    const rides = await prisma.ride.findMany({
      where: statusFilter,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        driver: { select: { id: true, name: true, phone: true, email: true } },
      },
      orderBy: { id: "desc" },
    });
    res.json(rides);
  } catch (error) {
    next(error);
  }
};
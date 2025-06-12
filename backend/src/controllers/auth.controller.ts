import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendVerificationEmail } from "../services/email.service";
import { Status } from "@prisma/client";

export const register = async (req: Request, res: Response) => {
  const { name, phone, email, password, role, vehicleType } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    // Validation: name and phone always required
    if (!name || !phone || !password || !role) {
      return res.status(400).json({ error: "Name, phone, password, and role are required." });
    }

    // If admin, email is required
    if (role === "ADMIN" && !email) {
      return res.status(400).json({ error: "Email is required for admins." });
    }

    // If driver, vehicleType is required
    if (role === "DRIVER" && !vehicleType) {
      return res.status(400).json({ error: "Vehicle type is required for drivers." });
    }

    // Validate enum for vehicleType if DRIVER
    if (role === "DRIVER" && !["CAR", "BIKE", "TUKTUK", "TRUCK"].includes(vehicleType)) {
      return res.status(400).json({ error: "Invalid vehicle type." });
    }

    const user = await prisma.user.create({
      data: {
        name,
        phone,
        email: email || null, // allow null email for customer/driver
        password: hashedPassword,
        role,
        verificationCode,
        status: "PENDING",
        vehicleType: role === "DRIVER" ? vehicleType : null,
      },
    });

    if (role === "ADMIN") {
      // Send verification code to admin's email
      await sendVerificationEmail(email, verificationCode);
    } else {
      // Send verification code to the admin's email with user info
      const adminEmail = process.env.ADMIN_EMAIL;
      if (!adminEmail) {
        return res.status(500).json({ error: "Admin email is not configured." });
      }
      const userInfo = `
        New ${role} registration:
        Name: ${name}
        Phone: ${phone}
        ${email ? "Email: " + email : ""}
        ${role === "DRIVER" ? "Vehicle Type: " + vehicleType : ""}
        Verification code: ${verificationCode}
      `;
      await sendVerificationEmail(adminEmail, userInfo);
    }

    res.status(201).json({ message: "User registered. Awaiting admin verification." });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

// LOGIN ENDPOINT FOR PHONE/CODE FLOW
export const login = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(400).json({ error: "User not found" });

    // If user is not verified, require code and check it
    if (user.status !== "VERIFIED") {
      if (!code) return res.status(400).json({ error: "Verification code required" });
      if (code !== user.verificationCode) return res.status(400).json({ error: "Invalid verification code" });

      // Mark user as verified and clear the code
      await prisma.user.update({
        where: { phone },
        data: { status: "VERIFIED", verificationCode: null },
      });
    }

    // Issue JWT token
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "30d" }
    );

    // Log for debugging
    console.log("Login user:", {
      id: user.id,
      role: user.role,
      vehicleType: user.vehicleType
    });

    // Return the role and user info in the response!
    res.json({
      message: "Login successful",
      token,
      role: user.role,
      user: {
        id: user.id,
        vehicleType: user.vehicleType,
        // add more fields if needed
      }
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const verifyCode = async (req: Request, res: Response) => {
  const { phone, code } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(400).json({ error: "User not found" });

    if (user.status === "VERIFIED") {
      // Already verified, just return token, role, and user info
      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        process.env.JWT_SECRET!,
        { expiresIn: "30d" }
      );
      return res.json({
        message: "Already verified",
        token,
        role: user.role,
        user: {
          id: user.id,
          vehicleType: user.vehicleType,
        }
      });
    }

    if (!code || code !== user.verificationCode) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    await prisma.user.update({
      where: { phone },
      data: { status: "VERIFIED", verificationCode: null },
    });

    // Issue JWT token
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "30d" }
    );

    res.json({
      message: "Verification successful",
      token,
      role: user.role,
      user: {
        id: user.id,
        vehicleType: user.vehicleType,
      }
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};
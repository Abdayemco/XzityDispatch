import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import transporter from "../config/email";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret_key";

// --- REGISTER CONTROLLER (unchanged, as before) ---
export const register = async (req: Request, res: Response, next: NextFunction) => {
  // ... your existing registration code ...
  try {
    const { name, phone, email, password, role, vehicleType } = req.body;

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !password?.trim() ||
      !role?.trim()
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      return res.status(409).json({ error: "User already exists with this phone" });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        phone: phone.trim(),
        email: email?.trim() || null,
        password: hashedPassword,
        role: role.trim(),
        vehicleType: role.trim() === "DRIVER" ? vehicleType?.toUpperCase() : null,
        verificationCode,
        status: "PENDING",
      },
    });

    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `New ${role} Registration – Verification Code`,
      text: [
        `A new ${role} has registered.`,
        "",
        `Name: ${name}`,
        `Phone: ${phone}`,
        `User Email: ${email?.trim() || "N/A"}`,
        `Verification Code: ${verificationCode}`,
        "",
        "Please send the verification code to the user via SMS or WhatsApp."
      ].join('\n')
    });

    return res.status(201).json({
      user: { id: user.id, phone: user.phone, email: user.email },
      message: "User registered. The admin has received the verification code and will contact you soon.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

// --- LOGIN CONTROLLER WITH TRUSTED DEVICE SUPPORT ---
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, deviceId, password } = req.body;

    if (!phone || !deviceId) {
      return res.status(400).json({ error: "Phone and deviceId are required." });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(401).json({ error: "Invalid phone." });
    }

    // 1. Check if device is already trusted
    const trustedDevice = await prisma.trustedDevice.findFirst({
      where: { userId: user.id, deviceId }
    });

    if (trustedDevice) {
      // Device is trusted, allow passwordless login
      if (user.status !== "ACTIVE") {
        return res.status(403).json({ error: "Account not active. Please verify your account." });
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        role: user.role?.toLowerCase(),
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          vehicleType: user.vehicleType || undefined
        }
      });
    }

    // 2. If device is not trusted, require password (optional: or send verification code)
    if (!password) {
      // User is on new device, ask frontend to show code input or password input
      return res.status(202).json({ action: "verification_required", message: "New device. Please verify." });
    }

    // Password login for new device (existing flow)
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid phone or password." });
    }

    if (user.status !== "ACTIVE") {
      return res.status(403).json({ error: "Account not active. Please verify your account." });
    }

    // If password correct, proceed to send verification code for new device
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode }
    });

    // Send code (e.g., to admin email or SMS)
    await transporter.sendMail({
      from: process.env.GMAIL_USER,
      to: process.env.ADMIN_EMAIL,
      subject: `Device Verification Required – ${user.phone}`,
      text: [
        `Verification code for new device login:`,
        "",
        `Name: ${user.name}`,
        `Phone: ${user.phone}`,
        `Code: ${verificationCode}`,
        "",
        "Send this code to the user via SMS/WhatsApp."
      ].join('\n')
    });

    return res.status(202).json({ action: "code_sent", message: "Verification code sent. Please verify." });
  } catch (error) {
    next(error);
  }
};

// --- VERIFY CODE CONTROLLER, NOW ADDS TRUSTED DEVICE ---
export const verifyCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, code, deviceId } = req.body;
    if (!phone || !code || !deviceId) {
      return res.status(400).json({ error: "Phone, code, and deviceId are required." });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(404).json({ error: "User not found." });

    if (user.verificationCode !== code) {
      return res.status(400).json({ error: "Invalid verification code." });
    }

    // Activate account if pending
    let updatedUser = user;
    if (user.status !== "ACTIVE") {
      updatedUser = await prisma.user.update({
        where: { phone },
        data: { status: "ACTIVE", verificationCode: null }
      });
    } else {
      await prisma.user.update({
        where: { phone },
        data: { verificationCode: null }
      });
    }

    // Add device as trusted
    await prisma.trustedDevice.upsert({
      where: {
        userId_deviceId: {
          userId: updatedUser.id,
          deviceId
        }
      },
      update: {},
      create: {
        userId: updatedUser.id,
        deviceId
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { id: updatedUser.id, phone: updatedUser.phone, role: updatedUser.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      role: updatedUser.role?.toLowerCase(),
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        phone: updatedUser.phone,
        email: updatedUser.email,
        vehicleType: updatedUser.vehicleType || undefined
      }
    });
  } catch (error) {
    next(error);
  }
};
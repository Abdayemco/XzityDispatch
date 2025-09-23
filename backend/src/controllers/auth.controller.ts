import { Request, Response, NextFunction } from "express";
import { prisma } from "../utils/prisma";
import transporter from "../config/email";
import jwt from "jsonwebtoken";
import parsePhoneNumber from "libphonenumber-js";
import { getName } from "country-list";

const JWT_SECRET = process.env.JWT_SECRET || "changeme_secret_key";

// --- Helper function to get country and area from phone ---
function detectCountryArea(phone: string) {
  try {
    const phoneNumber = parsePhoneNumber(phone);
    if (!phoneNumber) return { country: null, countryName: null, area: null };
    const country = phoneNumber.country || null;
    const countryName = country ? getName(country) : null;
    const nationalNumber = phoneNumber.nationalNumber || "";
    let area = null;
    if (nationalNumber.length >= 2) {
      area = nationalNumber.slice(0, 4);
    }
    return { country, countryName, area };
  } catch (err) {
    return { country: null, countryName: null, area: null };
  }
}

// --- REGISTER CONTROLLER ---
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, phone, email, password, role, vehicleType, avatar, hairType, beautyServices } = req.body;

    if (
      !name?.trim() ||
      !phone?.trim() ||
      !password?.trim() ||
      !role?.trim()
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // --- Add validation for new roles ---
    const upperRole = role.trim().toUpperCase();
    if (
      upperRole === "HAIR_DRESSER" &&
      !hairType
    ) {
      return res.status(400).json({ error: "hairType required for hair dresser registration" });
    }
    if (
      upperRole === "INSTITUTE" &&
      (!beautyServices || !Array.isArray(beautyServices) || beautyServices.length === 0)
    ) {
      return res.status(400).json({ error: "beautyServices required for institute registration" });
    }

    const existing = await prisma.user.findUnique({ where: { phone } });
    if (existing) {
      if (!existing.phoneVerified) {
        return res.status(202).json({
          action: "verification_required",
          message: "You are already registered. Please verify your phone.",
          phone: existing.phone,
        });
      }
      return res.status(409).json({ error: "User already exists with this phone" });
    }

    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const hashedPassword = password; // You should hash passwords in production!

    // --- Free Trial Logic for Drivers ---
    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;
    let subscriptionStatus: string | null = null;
    if (upperRole === "DRIVER") {
      trialStart = new Date();
      trialEnd = new Date();
      trialEnd.setMonth(trialEnd.getMonth() + 1);
      subscriptionStatus = "trial";
    }

    // --- Detect Country and Area from Phone ---
    const { country, countryName, area } = detectCountryArea(phone.trim());

    // --- Build userData with new fields ---
    let userData: any = {
      name: name.trim(),
      phone: phone.trim(),
      email: email?.trim() || null,
      password: hashedPassword,
      role: upperRole,
      vehicleType: upperRole === "DRIVER" ? vehicleType?.toUpperCase() : null,
      verificationCode,
      phoneVerified: false,
      disabled: false,
      avatar: avatar?.trim() || null,
      trialStart,
      trialEnd,
      subscriptionStatus,
      country,
      countryName,
      area,
    };

    // Add new fields based on role
    if (upperRole === "HAIR_DRESSER") {
      userData.hairType = hairType;
    }
    if (upperRole === "INSTITUTE") {
      userData.beautyServices = beautyServices;
    }

    const user = await prisma.user.create({
      data: userData,
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
        `Country: ${countryName || country || "N/A"}`,
        `Area: ${area || "N/A"}`,
        `Verification Code: ${verificationCode}`,
        upperRole === "HAIR_DRESSER" ? `Hair Type: ${hairType}` : "",
        upperRole === "INSTITUTE" ? `Beauty Services: ${(beautyServices || []).join(", ")}` : "",
        "",
        "Please send the verification code to the user via SMS or WhatsApp."
      ].join('\n')
    });

    return res.status(201).json({
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        avatar: user.avatar,
        country,
        countryName,
        area,
        hairType: user.hairType || undefined,
        beautyServices: user.beautyServices || undefined,
      },
      message: "User registered. The admin has received the verification code and will contact you soon.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    next(error);
  }
};

// --- LOGIN CONTROLLER ---
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, deviceId } = req.body;

    if (!phone || !deviceId) {
      return res.status(400).json({ error: "Phone and deviceId are required." });
    }

    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) {
      return res.status(401).json({ error: "Invalid phone." });
    }

    // Check if user is disabled
    if (user.disabled) {
      return res.status(403).json({ error: "Account disabled by admin." });
    }

    // Require phone verification
    if (!user.phoneVerified) {
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      await prisma.user.update({
        where: { id: user.id },
        data: { verificationCode }
      });

      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: process.env.ADMIN_EMAIL,
        subject: `Account Verification Required – ${user.phone}`,
        text: [
          `Verification code for account activation:`,
          "",
          `Name: ${user.name}`,
          `Phone: ${user.phone}`,
          `Code: ${verificationCode}`,
          "",
          "Send this code to the user via SMS/WhatsApp."
        ].join('\n')
      });

      return res.status(202).json({
        action: "verification_required",
        role: user.role ? user.role.toUpperCase() : null,
        message: "Phone not verified. Verification code sent."
      });
    }

    // Check trusted device
    const trustedDevice = await prisma.trustedDevice.findFirst({
      where: { userId: user.id, deviceId }
    });

    if (trustedDevice) {
      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        token,
        role: user.role ? user.role.toUpperCase() : null,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
          vehicleType: user.vehicleType || undefined,
          avatar: user.avatar || null,
          country: user.country || null,
          countryName: user.countryName || null,
          area: user.area || null,
          hairType: user.hairType || undefined,
          beautyServices: user.beautyServices || undefined,
        }
      });
    }

    // If device is not trusted, require verification
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode }
    });

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

    return res.status(202).json({
      action: "verification_required",
      role: user.role ? user.role.toUpperCase() : null,
      message: "Verification code sent. Please verify."
    });
  } catch (error) {
    next(error);
  }
};

// --- VERIFY CODE CONTROLLER ---
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

    // Mark phone as verified and clear the code
    await prisma.user.update({
      where: { phone },
      data: { phoneVerified: true, verificationCode: null }
    });

    // Add device as trusted
    await prisma.trustedDevice.upsert({
      where: {
        userId_deviceId: {
          userId: user.id,
          deviceId
        }
      },
      update: {},
      create: {
        userId: user.id,
        deviceId
      }
    });

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      role: user.role ? user.role.toUpperCase() : null,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        vehicleType: user.vehicleType || undefined,
        avatar: user.avatar || null,
        country: user.country || null,
        countryName: user.countryName || null,
        area: user.area || null,
        hairType: user.hairType || undefined,
        beautyServices: user.beautyServices || undefined,
      }
    });
  } catch (error) {
    next(error);
  }
};
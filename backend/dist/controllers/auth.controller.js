"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyCode = exports.login = exports.register = void 0;
const prisma_1 = require("../utils/prisma");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const email_service_1 = require("../services/email.service");
const register = async (req, res) => {
    const { name, phone, email, password, role } = req.body;
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
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
        const user = await prisma_1.prisma.user.create({
            data: {
                name,
                phone,
                email: email || null, // allow null email for customer/driver
                password: hashedPassword,
                role,
                verificationCode,
                status: "PENDING",
            },
        });
        if (role === "ADMIN") {
            // Send verification code to admin's email
            await (0, email_service_1.sendVerificationEmail)(email, verificationCode);
        }
        else {
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
        Verification code: ${verificationCode}
      `;
            await (0, email_service_1.sendVerificationEmail)(adminEmail, userInfo);
        }
        res.status(201).json({ message: "User registered. Awaiting admin verification." });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.register = register;
// LOGIN ENDPOINT FOR PHONE/CODE FLOW
const login = async (req, res) => {
    const { phone, code } = req.body;
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { phone } });
        if (!user)
            return res.status(400).json({ error: "User not found" });
        // If user is not verified, require code and check it
        if (user.status !== "VERIFIED") {
            if (!code)
                return res.status(400).json({ error: "Verification code required" });
            if (code !== user.verificationCode)
                return res.status(400).json({ error: "Invalid verification code" });
            // Mark user as verified and clear the code
            await prisma_1.prisma.user.update({
                where: { phone },
                data: { status: "VERIFIED", verificationCode: null },
            });
        }
        // Issue JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id, phone: user.phone, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
        // Return the role in the response!
        res.json({ message: "Login successful", token, role: user.role });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.login = login;
// ADD THIS FUNCTION:
const verifyCode = async (req, res) => {
    const { phone, code } = req.body;
    try {
        const user = await prisma_1.prisma.user.findUnique({ where: { phone } });
        if (!user)
            return res.status(400).json({ error: "User not found" });
        if (user.status === "VERIFIED") {
            // Already verified, just return token and role
            const token = jsonwebtoken_1.default.sign({ id: user.id, phone: user.phone, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
            return res.json({ message: "Already verified", token, role: user.role });
        }
        if (!code || code !== user.verificationCode) {
            return res.status(400).json({ error: "Invalid verification code" });
        }
        await prisma_1.prisma.user.update({
            where: { phone },
            data: { status: "VERIFIED", verificationCode: null },
        });
        // Issue JWT token
        const token = jsonwebtoken_1.default.sign({ id: user.id, phone: user.phone, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.json({ message: "Verification successful", token, role: user.role });
    }
    catch (e) {
        res.status(400).json({ error: e.message });
    }
};
exports.verifyCode = verifyCode;

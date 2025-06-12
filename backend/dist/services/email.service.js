"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendVerificationEmail = sendVerificationEmail;
const email_1 = __importDefault(require("../config/email")); // adjust to match your export
async function sendVerificationEmail(to, code) {
    try {
        console.log(`Attempting to send verification email to ${to} with code ${code}`);
        const info = await email_1.default.sendMail({
            from: `"XZity App" <${process.env.GMAIL_USER}>`,
            to,
            subject: "Your Verification Code",
            text: `Your verification code is: ${code}`,
        });
        console.log("Verification email sent:", info.messageId, info.response);
    }
    catch (error) {
        console.error("Error sending verification email:", error);
    }
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdminVerificationEmail = sendAdminVerificationEmail;
const email_1 = __importDefault(require("../config/email"));
async function sendAdminVerificationEmail({ adminEmail, userName, userPhone, verificationCode, userRole, }) {
    const info = await email_1.default.sendMail({
        from: `"xzity Dispatch" <${process.env.GMAIL_USER}>`,
        to: adminEmail,
        subject: `New ${userRole} Registration: ${userName}`,
        text: `A new ${userRole} has registered.\n\nName: ${userName}\nPhone: ${userPhone}\nVerification Code: ${verificationCode}\nSend this code to the user manually.`,
    });
    return info;
}

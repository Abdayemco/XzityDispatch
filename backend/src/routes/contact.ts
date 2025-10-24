import { Router } from "express";
import transporter from "../config/email"; // adjust if needed

// TEMPORARY TEST CODE
transporter.sendMail({
  from: process.env.GMAIL_USER,
  to: process.env.ADMIN_EMAIL,
  subject: "Test email from backend",
  text: "If you receive this, your transporter works!"
}, (err, info) => {
  if (err) {
    console.error("Email test failed:", err);
  } else {
    console.log("Email test succeeded:", info);
  }
});

// ...rest of your contact router code...
const router = Router();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || process.env.GMAIL_USER || "admin@email.com";

router.post("/contact-admin", async (req, res) => {
  const { name, tel, message } = req.body;
  if (!name || !tel || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    await transporter.sendMail({
      from: `"Blocked User Contact" <${ADMIN_EMAIL}>`,
      to: ADMIN_EMAIL,
      subject: "Blocked User Contact Request",
      text: `Name: ${name}\nTel: ${tel}\nMessage: ${message}`,
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error("Failed to send contact-admin email:", err.message, err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
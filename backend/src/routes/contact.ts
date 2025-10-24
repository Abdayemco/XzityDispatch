import { Router } from "express";
import { Resend } from "resend";

const router = Router();

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@email.com";

// POST /contact-admin route
router.post("/contact-admin", async (req, res) => {
  const { name, tel, message } = req.body;
  if (!name || !tel || !message) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const result = await resend.emails.send({
      from: "info@xzity.com", // Use your verified sender domain from Resend
      to: ADMIN_EMAIL,
      subject: "Blocked User Contact Request",
      text: `Name: ${name}\nTel: ${tel}\nMessage: ${message}`,
    });
    res.json({ success: true, result });
  } catch (err: any) {
    console.error("Failed to send contact-admin email:", err.message, err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
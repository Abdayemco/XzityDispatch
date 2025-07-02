import "dotenv/config";
import transporter from "./src/config/email"; // Adjust path if your email.ts is elsewhere

async function sendTestEmail() {
  try {
    const info = await transporter.sendMail({
      from: `"XZity App" <${process.env.GMAIL_USER}>`,
      to: process.env.GMAIL_USER, // send to yourself for testing
      subject: "Test Email from XZity App",
      text: "This is a test email sent using Nodemailer and Gmail SMTP.",
    });
    console.log("Test email sent:", info.messageId);
  } catch (error) {
    console.error("Error sending test email:", error);
  }
}

sendTestEmail();
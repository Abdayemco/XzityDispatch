import transporter from "../config/email"; // adjust to match your export

export async function sendVerificationEmail(to: string, code: string) {
  try {
    console.log(`Attempting to send verification email to ${to} with code ${code}`);
    const info = await transporter.sendMail({
      from: `"XZity App" <${process.env.GMAIL_USER}>`,
      to,
      subject: "Your Verification Code",
      text: `Your verification code is: ${code}`,
    });
    console.log("Verification email sent:", info.messageId, info.response);
  } catch (error) {
    console.error("Error sending verification email:", error);
  }
}
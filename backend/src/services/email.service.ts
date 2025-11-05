import resend from "../config/email"; // your config exports a Resend client

export async function sendVerificationEmail(to: string, code: string) {
  try {
    console.log(`Attempting to send verification email to ${to} with code ${code}`);
    const data = await resend.emails.send({
      from: "info@xzity.com", // your verified sender address for Resend
      to,
      subject: "Your Verification Code",
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <b>${code}</b></p>`
    });
    console.log("Verification email sent:", data.id, data);
  } catch (error) {
    console.error("Error sending verification email:", error);
  }
}
import resend from "../config/email";

/**
 * Sends a verification email to the specified recipient with the given code.
 * @param to - email address to send to
 * @param code - verification code
 */
export async function sendVerificationEmail(to: string, code: string) {
  try {
    console.log(`Attempting to send verification email to ${to} with code ${code}`);
    const result = await resend.emails.send({
      from: "info@xzity.com", // Must be a verified sender on Resend
      to,
      subject: "Your Verification Code",
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <b>${code}</b></p>`,
    });
    if (result.error) {
      console.error("Error sending verification email:", result.error);
    } else {
      console.log("Verification email sent:", result.data?.id, result.data);
    }
  } catch (error) {
    console.error("Error sending verification email (exception):", error);
  }
}
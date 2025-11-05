import resend from "../config/email";

export async function sendVerificationEmail(to: string, code: string) {
  try {
    console.log(`Attempting to send verification email to ${to} with code ${code}`);
    const result = await resend.emails.send({
      from: "info@xzity.com", // Use your verified sender address with Resend
      to,
      subject: "Your Verification Code",
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <b>${code}</b></p>`
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
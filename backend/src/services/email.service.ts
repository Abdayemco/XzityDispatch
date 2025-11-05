import resend from "../config/email";

/**
 * Sends an admin notification about a user registration or login
 * requiring phone verification (includes all key user details).
 */
export async function sendAdminVerificationEmail({
  to,
  code,
  name,
  phone,
  role
}: {
  to: string,
  code: string,
  name: string,
  phone: string,
  role: string
}) {
  try {
    const html = `
      <h2>User Registration - Verification Required</h2>
      <ul>
        <li><b>Name:</b> ${name}</li>
        <li><b>Phone:</b> ${phone}</li>
        <li><b>Role:</b> ${role}</li>
        <li><b>Verification code:</b> <span style="font-size:1.3em;color:#1976d2;"><b>${code}</b></span></li>
      </ul>
      <p>Please send the verification code to the user via SMS or WhatsApp to the above phone number.</p>
    `;
    const text = [
      "User Registration - Verification Required",
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Role: ${role}`,
      `Verification code: ${code}`,
      "",
      "Please send the verification code to the user via SMS or WhatsApp to the above phone number."
    ].join('\n');

    const result = await resend.emails.send({
      from: "info@xzity.com",
      to,
      subject: "New User Registration: Action Required for Verification",
      html,
      text,
    });
    if (result.error) {
      console.error("Error sending admin verification email:", result.error);
    } else {
      console.log("Admin verification email sent:", result.data?.id, result.data);
    }
  } catch (error) {
    console.error("Error sending admin verification email (exception):", error);
  }
}
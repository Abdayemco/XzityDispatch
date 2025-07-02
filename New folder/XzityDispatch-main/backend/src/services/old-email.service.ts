import transporter from "../config/email";

export async function sendAdminVerificationEmail({
  adminEmail,
  userName,
  userPhone,
  verificationCode,
  userRole,
}: {
  adminEmail: string;
  userName: string;
  userPhone: string;
  verificationCode: string;
  userRole: string;
}) {
  const info = await transporter.sendMail({
    from: `"xzity Dispatch" <${process.env.GMAIL_USER}>`,
    to: adminEmail,
    subject: `New ${userRole} Registration: ${userName}`,
    text: `A new ${userRole} has registered.\n\nName: ${userName}\nPhone: ${userPhone}\nVerification Code: ${verificationCode}\nSend this code to the user manually.`,
  });
  return info;
}
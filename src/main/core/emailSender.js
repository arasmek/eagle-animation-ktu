import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
dotenv.config();

export async function sendExportEmail({ to, link }) {
  console.log('[EMAIL] sendExportEmail called with:', { to, link });

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"Audiovisual lab" <${process.env.SMTP_USER}>`,
    to,
    subject: 'STOP ANIMACIJA!',
    html: `Jūsų sukurta animacija paruošta. Parsisiųskite ją į savo įrenginį.:\n${link}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`[EMAIL] Sent to ${to}`);
    return true;
  } catch (err) {
    console.error('[EMAIL] Error:', err);
    return false;
  }
}

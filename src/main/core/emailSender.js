import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import path from 'node:path';
import fs from 'node:fs';
import { app } from 'electron';

(() => {
  try {
    const userData = app?.getPath('userData') || process.cwd();
    const userEnv = path.join(userData, '.env');
    if (fs.existsSync(userEnv)) {
      dotenv.config({ path: userEnv });
      return;
    }
    const resourcesBase = app?.isPackaged ? process.resourcesPath : path.join(process.cwd(), 'resources');
    const bundledEnv = path.join(resourcesBase, '.env');
    if (fs.existsSync(bundledEnv)) {
      dotenv.config({ path: bundledEnv });
      return;
    }
    dotenv.config();
  } catch {
    dotenv.config();
  }
})();

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
    from: `"Stop Motion KTU IF" <${process.env.SMTP_USER}>`,
    to,
    subject: 'STOP ANIMACIJA!',
    html: `Jūsų sukurta animacija paruošta. Parsisiųskite ją į savo įrenginį.: \n${link}`,
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

import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user, pass },
    });
  }
  return transporter;
}

export async function sendAlertEmail(subject: string, text: string): Promise<boolean> {
  const to = process.env.ALERT_EMAIL_TO;
  const transport = getTransporter();
  if (!transport || !to) return false;

  try {
    await transport.sendMail({
      from: process.env.GMAIL_USER,
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error("Failed to send alert email:", err);
    return false;
  }
}

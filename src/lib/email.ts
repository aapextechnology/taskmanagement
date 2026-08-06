import nodemailer from "nodemailer";
import { env } from "@/lib/env";

// Transactional email (T-062). SMTP from env — mailpit in the dev stack,
// company SMTP or Resend in production. Failures are logged, never thrown:
// email is a side channel, the in-app notification is the source of truth.

let transport: nodemailer.Transporter | undefined;

function getTransport() {
  transport ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER
      ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
      : undefined,
  });
  return transport;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<void> {
  try {
    await getTransport().sendMail({
      from: env.SMTP_FROM,
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  } catch (error) {
    console.error(`[email] send failed to ${input.to}:`, error);
  }
}

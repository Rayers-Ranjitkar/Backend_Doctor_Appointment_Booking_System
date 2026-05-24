import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

// Checks whether SMTP environment configurations are available for sending emails
function canSendEmail() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

// Initializes and returns the Nodemailer transporter instance if config is available
function getTransporter() {
  if (!canSendEmail()) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: {
        user: env.smtpUser,
        pass: env.smtpPass,
      },
    });
  }

  return transporter;
}

// Sends a reminder email via SMTP or logs a message in console as fallback
export async function sendReminderEmail({ to, subject, text }) {
  const mailer = getTransporter();

  if (!mailer) {
    console.log(`[Reminder fallback] To: ${to} | Subject: ${subject} | ${text}`);
    return { delivered: false, mode: 'console-fallback' };
  }

  await mailer.sendMail({
    from: env.smtpFrom,
    to,
    subject,
    text,
  });

  return { delivered: true, mode: 'smtp' };
}

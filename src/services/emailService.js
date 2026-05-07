import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter = null;

function canSendEmail() {
  return Boolean(env.smtpHost && env.smtpUser && env.smtpPass);
}

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
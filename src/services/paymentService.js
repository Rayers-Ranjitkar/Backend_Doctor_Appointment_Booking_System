import { env } from '../config/env.js';

/** Khalti returns { error_key, field: ["msg"], detail?: string } — surface readable text. */
function formatKhaltiErrorBody(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.detail === 'string' && data.detail.trim()) return data.detail.trim();
  const parts = [];
  for (const [key, val] of Object.entries(data)) {
    if (key === 'error_key' || key === 'status_code' || key === 'detail') continue;
    if (Array.isArray(val)) parts.push(`${key}: ${val.join('; ')}`);
    else if (typeof val === 'string') parts.push(`${key}: ${val}`);
  }
  if (parts.length) return parts.join(' ');
  if (typeof data.error_key === 'string') return data.error_key;
  return null;
}

function khaltiBaseUrl() {
  return env.khaltiGatewayBaseUrl || 'https://dev.khalti.com/api/v2';
}

function khaltiHeaders() {
  return {
    Authorization: `Key ${env.khaltiSecretKey}`,
    'Content-Type': 'application/json',
  };
}

export function createKhaltiPayment({
  amount,
  appointmentId,
  patientId,
  doctorId,
  status = 'initiated',
  reference = '',
  paidAt = '',
}) {
  return {
    id: `pay${Date.now()}${Math.floor(Math.random() * 1000)}`,
    appointmentId,
    patientId,
    doctorId,
    amount,
    provider: 'khalti',
    status,
    reference,
    paidAt,
  };
}

export async function initiateKhaltiPayment(payload) {
  const response = await fetch(`${khaltiBaseUrl()}/epayment/initiate/`, {
    method: 'POST',
    headers: khaltiHeaders(),
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = formatKhaltiErrorBody(data) || 'Unable to initiate Khalti payment.';
    throw new Error(msg);
  }
  return data;
}

export async function lookupKhaltiPayment(pidx) {
  const response = await fetch(`${khaltiBaseUrl()}/epayment/lookup/`, {
    method: 'POST',
    headers: khaltiHeaders(),
    body: JSON.stringify({ pidx }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const msg = formatKhaltiErrorBody(data) || 'Unable to verify Khalti payment.';
    throw new Error(msg);
  }
  return data;
}

/** Omit empty customer_info fields; omit block if empty (Khalti treats customer_info as optional). */
export function buildKhaltiCustomerInfo({ patientName, patientEmail, patientPhone }) {
  const info = {};
  if (patientName && String(patientName).trim()) info.name = String(patientName).trim();
  if (patientEmail && String(patientEmail).trim()) info.email = String(patientEmail).trim();
  const digits = String(patientPhone || '').replace(/\D/g, '');
  const phone = digits.length >= 10 ? digits.slice(-10) : digits.length > 0 ? digits : '';
  if (phone) info.phone = phone;
  return info;
}

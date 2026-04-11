
export function createKhaltiPayment({ amount, appointmentId, patientId, doctorId }) {
  return {
    id: `pay${Date.now()}`,
    appointmentId,
    patientId,
    doctorId,
    amount,
    provider: 'khalti',
    status: 'paid',
    reference: `KHALTI-DEMO-${Math.floor(Math.random() * 100000)}`,
    paidAt: new Date().toISOString(),
  };
}

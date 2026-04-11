function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const state = {
  appointments: [],
  payments: [],
};

// check if slot already booked
function isSlotTaken({ doctorId, date, time, excludeAppointmentId }) {
  return state.appointments.some(
    (appointment) =>
      appointment.doctorId === doctorId &&
      appointment.date === date &&
      appointment.time === time &&
      appointment.id !== excludeAppointmentId &&
      appointment.status !== 'cancelled'
  );
}

export const clinicStore = {

  // BOOK APPOINTMENT
  bookAppointment(payload) {
    if (isSlotTaken(payload)) {
      return { error: 'Selected slot is already booked.' };
    }

    const appointment = {
      id: `a${Date.now()}`,
      patientId: payload.patientId,
      patientName: payload.patientName,
      patientAge: payload.patientAge,
      doctorId: payload.doctorId,
      doctorName: payload.doctorName,
      specialty: payload.specialty,
      hospital: payload.hospital,
      date: payload.date,
      time: payload.time,
      reason: payload.reason,
      notes: payload.notes || '',
      doctorImage: payload.doctorImage,

      status: payload.paymentStatus === 'paid' ? 'confirmed' : 'pending',
      paymentStatus: payload.paymentStatus || 'awaiting_payment',

      queueNumber: 0,
      estimatedWaitMinutes: 0,
    };

    state.appointments.unshift(appointment);

    return { appointment: clone(appointment) };
  },

  // UPDATE APPOINTMENT
  updateAppointment(id, updates) {
    const appointment = state.appointments.find((a) => a.id === id);

    if (!appointment) {
      return { error: 'Appointment not found.' };
    }

    if ((updates.date || updates.time) && isSlotTaken({
      doctorId: appointment.doctorId,
      date: updates.date || appointment.date,
      time: updates.time || appointment.time,
      excludeAppointmentId: appointment.id,
    })) {
      return { error: 'Requested slot already taken.' };
    }

    Object.assign(appointment, updates);

    return { appointment: clone(appointment) };
  },

  //  CREATE PAYMENT
  createPayment(payload) {
    const appointment = state.appointments.find(
      (a) => a.id === payload.appointmentId
    );

    if (!appointment) {
      return { error: 'Appointment not found for payment.' };
    }

    const payment = {
      id: `p${Date.now()}`,
      appointmentId: payload.appointmentId,
      doctorId: appointment.doctorId,
      patientId: appointment.patientId,
      amount: payload.amount,
      provider: payload.provider,
      reference: payload.reference,
      status: payload.status || 'paid',
      paidAt: new Date().toISOString(),
    };

    state.payments.unshift(payment);

    // update appointment payment status
    appointment.paymentStatus = payment.status;
    if (payment.status === 'paid') {
      appointment.status = 'confirmed';
    }

    return { payment: clone(payment) };
  },

  //  GET ALL APPOINTMENTS
  getAppointments() {
    return clone(state.appointments);
  },

  //  GET PAYMENTS
  getPayments() {
    return clone(state.payments);
  },
};
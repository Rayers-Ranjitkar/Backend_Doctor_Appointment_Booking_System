import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true },
    appointmentId: String,
    doctorId: String,
    patientId: String,
    rating: Number,
    comment: String,
    createdAt: String,
  },
  { timestamps: true, versionKey: false },
);

export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);
import mongoose from 'mongoose';
import { env } from './env.js';

let connected = false;

export async function connectDatabase() {
  if (!env.mongoUri) {
    console.log('MongoDB URI not provided. Backend will run with in-memory demo data.');
    return false;
  }

  if (connected) {
    return true;
  }

  await mongoose.connect(env.mongoUri);
  connected = true;
  console.log('MongoDB connected.');
  return true;
}

export function isDatabaseConnected() {
  return connected;
}

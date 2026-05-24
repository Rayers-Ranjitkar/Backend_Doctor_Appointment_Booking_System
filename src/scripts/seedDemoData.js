// Script to output serialized demo clinic data as JSON
import { demoClinic } from '../data/demoData.js';

console.log(JSON.stringify(demoClinic, null, 2));

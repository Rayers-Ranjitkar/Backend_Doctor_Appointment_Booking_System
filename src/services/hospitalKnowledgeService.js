import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const knowledgeDir = path.resolve(__dirname, '../../data');

function readJson(fileName) {
  const filePath = path.join(knowledgeDir, fileName);
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

export function loadHospitalKnowledge() {
  return {
    profile: readJson('hospitalProfile.json'),
    departments: readJson('departments.json'),
    services: readJson('services.json'),
    faqs: readJson('hospitalFaqs.json'),
    policies: readJson('hospitalPolicies.json'),
  };
}

/**
 * aiService.js — MediBook AI hospital assistant (Groq-powered)
 *
 * Important:
 * - Always return valid JSON in the expected structure.
 * - Used by POST /api/assistant via clinic stores.
 */

import { loadHospitalKnowledge } from './hospitalKnowledgeService.js';
import { env } from '../config/env.js';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a compact JSON context string so the assistant knows about the hospital,
 * its departments, and all active doctors.
 */
function buildHospitalContext(clinic) {
  const knowledge = loadHospitalKnowledge();

  const activeDoctors = clinic.doctors
    .filter((d) => d.status === 'active')
    .map((d) => ({
      id: d.id,
      name: d.name,
      specialty: d.specialty,
      experience: d.experience,
      rating: d.rating,
      availableDays: d.availableDays,
      nextSlot: d.timeSlots?.[0] ?? 'N/A',
      about: d.about,
    }));

  const departments = knowledge.departments.map((dept) => ({
    name: dept.name,
    summary: dept.summary,
    services: dept.services,
  }));

  return JSON.stringify(
    {
      hospital: {
        name: knowledge.profile.name,
        tagline: knowledge.profile.tagline,
        address: knowledge.profile.address,
        contact: knowledge.profile.contact,
        hours: knowledge.profile.hours,
        about: knowledge.profile.about,
      },
      departments,
      activeDoctors,
      faqs: knowledge.faqs,
      services: knowledge.services,
      policies: knowledge.policies,
    },
    null,
    2
  );
}

/**
 * The system prompt that tells the assistant exactly how to behave.
 */
function buildSystemPrompt(hospitalContext) {
  return `You are MediBook AI, the helpful assistant for this hospital's online appointment system.

HOSPITAL DATA (JSON — use this as your single source of truth):
${hospitalContext}

YOUR RULES:
1. Always reply in this exact JSON structure — no markdown, no extra text:
   {
     "summary": "<your friendly reply, 1–3 sentences>",
     "suggestions": ["<up to 4 short follow-up chips>"],
     "recommendedDoctorId": "<doctor id string, or null>",
     "action": "<'answer_question' | 'recommend_doctor'>"
   }

GREETINGS:
If the message is only a greeting (hi/hello/how are you/hey) and contains no symptoms,
set action = "answer_question", recommendedDoctorId = null, and respond with a short friendly greeting plus helpful suggestions.

2. When a patient describes SYMPTOMS or asks who to see:
   • Map their symptoms to the most relevant department.
   • Pick the best matching ACTIVE doctor from the hospital data above.
   • Set action = "recommend_doctor" and fill recommendedDoctorId.
   • Keep summary concise because the server will format the final doctor recommendation block.

   If the symptoms are unclear or missing important details:
   • Set action = "answer_question"
   • Set recommendedDoctorId = null
   • Ask 1–2 brief clarifying questions in summary.

   EMERGENCY RED FLAGS:
   If the patient mentions any red-flag emergency symptoms (severe chest pain, severe difficulty breathing, fainting, signs of stroke, uncontrolled bleeding, severe allergic reaction, suicidal thoughts):
   • Set action = "answer_question"
   • Set recommendedDoctorId = null
   • In summary, advise immediate emergency care (call your local emergency number / go to ER).

3. For hospital info (hours, address, contact, policies, FAQs):
   • Answer directly from the hospital data.
   • Set action = "answer_question", recommendedDoctorId = null.

4. If the query is completely unrelated to healthcare or the hospital:
   • Politely say you can only help with hospital and health topics.

5. When you recommend a doctor:
   • suggestions must include the recommended doctor as the FIRST chip in the exact format "Dr. Name" (exactly matching hospital data).
6. Keep suggestions short (2–6 words each), actionable, and relevant.
7. Be warm, professional, and concise. Never make up information not in the data.`;
}

/**
 * Fallback reply when the AI service is unavailable or returns an unparseable response.
 */
function fallbackReply(knowledge) {
  const deptNames = knowledge.departments.map((d) => d.name).slice(0, 4);
  return {
    summary: `I'm having trouble reaching the AI service right now. You can ask about ${knowledge.profile.name}'s departments, timings, or contact details — or tell me your symptom and I'll suggest a doctor.`,
    suggestions: deptNames,
    recommendedDoctorId: null,
    action: 'answer_question',
  };
}

function formatRating(value) {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'N/A';
  return Number.isInteger(numeric) ? `${numeric}/5` : `${numeric.toFixed(1)}/5`;
}

function buildDoctorRecommendationSummary(clinic, recommendedDoctorId) {
  const recommendedDoctor = clinic.doctors.find((doctor) => doctor.id === recommendedDoctorId);
  if (!recommendedDoctor) return null;

  const department = recommendedDoctor.specialty || 'General Practice';
  const departmentDoctors = clinic.doctors
    .filter((doctor) => doctor.status === 'active' && doctor.specialty === department)
    .sort((a, b) => {
      const ratingDiff = Number(b.rating || 0) - Number(a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return Number(b.experience || 0) - Number(a.experience || 0);
    })
    .slice(0, 3);

  if (!departmentDoctors.length) return null;

  const doctorSections = departmentDoctors.map((doctor) => {
    const availableTimes = Array.isArray(doctor.timeSlots) && doctor.timeSlots.length
      ? doctor.timeSlots.slice(0, 2).join(', ')
      : 'No time slots available';

    return `**${doctor.name} (${doctor.specialty})**\n\n- Available: ${availableTimes}\n- Ratings: ${formatRating(doctor.rating)}`;
  });

  return [
    `Recommended Department: ${department}`,
    '',
    'Here are available doctors for you:',
    '',
    doctorSections.join('\n\n'),
    '',
    'Which doctor and time would you prefer?',
  ].join('\n');
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * answerAssistant(prompt, clinic)
 *
 * Called by both clinicStore (in-memory) and dbClinicStore (MongoDB).
 * The `clinic` object must have at least: { doctors: [...] }
 */
export async function answerAssistant(prompt, clinic, conversationHistory = []) {
  const knowledge = loadHospitalKnowledge();

  // Guard: no API key configured
  if (!env.groqApiKey) {
    console.warn('[aiService] GROQ_API_KEY not set — using fallback reply.');
    return fallbackReply(knowledge);
  }

  // Guard: empty prompt
  const cleanPrompt = (prompt || '').trim();
  if (!cleanPrompt) {
    return {
      summary: 'Please type your question or describe your symptoms and I will help you.',
      suggestions: ['Hospital hours', 'Find a doctor', 'Departments', 'Contact info'],
      recommendedDoctorId: null,
      action: 'answer_question',
    };
  }

  const hospitalContext = buildHospitalContext(clinic);
  const systemPrompt = buildSystemPrompt(hospitalContext);
  const historyMessages = Array.isArray(conversationHistory)
    ? conversationHistory
        .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string' && item.content.trim())
        .slice(-12)
        .map((item) => ({
          role: item.role,
          content: item.content.trim(),
        }))
    : [];

  const requestBody = {
    model: env.groqModel || 'llama-3.1-8b-instant',
    messages: [
      { role: 'system', content: systemPrompt },
      ...historyMessages,
      { role: 'user', content: cleanPrompt },
    ],
    temperature: 0.2, // more consistent JSON
    top_p: 0.9,
    max_tokens: 320,
  };

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(15_000), // 15 s timeout
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[aiService] Groq HTTP ${response.status}: ${errorText}`);

      // Rate limit hit — return a polite message
      if (response.status === 429) {
        return {
          summary: 'The AI assistant is briefly busy. Please wait a moment and try again.',
          suggestions: ['Try again', 'Hospital hours', 'Departments'],
          recommendedDoctorId: null,
          action: 'answer_question',
        };
      }

      return fallbackReply(knowledge);
    }

    const data = await response.json();

    // Extract the raw text from Groq's OpenAI-compatible response structure
    const rawText = data?.choices?.[0]?.message?.content ?? '';

    if (!rawText) {
      console.error('[aiService] Groq returned empty text.');
      return fallbackReply(knowledge);
    }

    // Strip possible markdown fences (```json ... ```) and extract JSON object.
    const fencedStripped = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const firstBrace = fencedStripped.indexOf('{');
    const lastBrace = fencedStripped.lastIndexOf('}');
    const jsonText =
      firstBrace !== -1 && lastBrace !== -1
        ? fencedStripped.slice(firstBrace, lastBrace + 1)
        : fencedStripped;

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      console.error('[aiService] Failed to parse Groq JSON:', jsonText);
      return fallbackReply(knowledge);
    }

    // Validate and sanitise the parsed object
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : 'I can help with hospital information and doctor recommendations. What would you like to know?';

    const suggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((s) => typeof s === 'string').slice(0, 4)
      : [];

    // Make sure the recommended doctor actually exists in our data
    const doctorExists =
      parsed.recommendedDoctorId &&
      clinic.doctors.some((d) => d.id === parsed.recommendedDoctorId);

    const recommendedDoctorId = doctorExists ? parsed.recommendedDoctorId : null;

    const action =
      parsed.action === 'recommend_doctor' && recommendedDoctorId
        ? 'recommend_doctor'
        : 'answer_question';

    const normalizedSummary =
      action === 'recommend_doctor' && recommendedDoctorId
        ? buildDoctorRecommendationSummary(clinic, recommendedDoctorId) || summary
        : summary;

    return {
      summary: normalizedSummary,
      suggestions,
      recommendedDoctorId,
      action,
    };
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error('[aiService] Groq request timed out.');
      return {
        summary: 'The AI assistant is taking too long to respond. Please try again in a moment.',
        suggestions: ['Try again', 'Hospital hours', 'Departments'],
        recommendedDoctorId: null,
        action: 'answer_question',
      };
    }

    console.error('[aiService] Unexpected error calling Groq:', error);
    return fallbackReply(knowledge);
  }
}
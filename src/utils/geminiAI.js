// Google Gemini AI Client for Holobox Virtual Mirror Custom Look Generator

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

// Try fastest responsive model with short timeout so offline kiosks never stall
const CANDIDATE_MODELS = ['gemini-flash-lite-latest'];

export async function interpretPromptWithGemini(userPrompt, gender = 'male') {
  const prompt = `You are the futuristic AI Stylist for the Holobox Interactive Virtual Mirror.
A user said: "${userPrompt}" (Gender collection: ${gender}).

Classify and customize their persona. Map to one of the 5 closest available 3D avatar base rigs:
"pilot", "doctor", "astronaut", "police", or "business".

Return ONLY a valid JSON object (no markdown, no backticks, no other text):
{
  "targetProfession": "pilot" | "doctor" | "astronaut" | "police" | "business",
  "customTitle": "Creative Futuristic Title (3-5 words)",
  "customDescription": "Short futuristic wardrobe description (15-20 words)",
  "primaryColor": "#hexColor",
  "accentColor": "#hexColor",
  "aiCompliment": "Exciting 1-sentence mirror hologram compliment"
}`;

  for (const model of CANDIDATE_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300
          }
        })
      });
      clearTimeout(timer);

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          // Clean possible markdown code fences
          const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleaned);

          return {
            targetProfession: parsed.targetProfession || 'pilot',
            customTitle: parsed.customTitle || `Custom Look: ${userPrompt.slice(0, 18)}...`,
            customDescription: parsed.customDescription || `AI-configured persona based on: "${userPrompt}"`,
            primaryColor: parsed.primaryColor || '#0ea5e9',
            accentColor: parsed.accentColor || '#38bdf8',
            decorations: getDecorationTheme(parsed.targetProfession),
            aiCompliment: parsed.aiCompliment || 'Looking sharp in the Holobox mirror!'
          };
        }
      }
    } catch (err) {
      clearTimeout(timer);
      console.warn(`Gemini model ${model} fetch failed, trying next fallback:`, err.message);
    }
  }

  // Fallback if network unavailable
  return null;
}

function getDecorationTheme(profession) {
  switch (profession) {
    case 'doctor': return 'medical';
    case 'astronaut': return 'space';
    case 'pilot': return 'aviation';
    case 'police': return 'police';
    case 'business': return 'business';
    default: return 'custom';
  }
}

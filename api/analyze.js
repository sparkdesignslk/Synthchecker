export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) return res.status(400).json({ error: 'Missing imageData or mimeType' });

    const prompt = `You are an expert forensic image analyst. Analyze this image for signs of AI generation.
Respond with ONLY a valid JSON object. No markdown. No code fences. No text before or after the JSON.
Exact structure to follow:
{"verdict":"AI_GENERATED","confidence":85,"ai_probability":85,"authentic_probability":15,"indicators":[{"type":"ai","text":"observation one"},{"type":"real","text":"observation two"},{"type":"neutral","text":"observation three"}],"summary":"Short plain summary here"}
Important: Do NOT use any quotes, apostrophes, or special characters inside the text or summary values. verdict must be AI_GENERATED, AUTHENTIC, or UNCERTAIN. type must be ai, real, or neutral.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.0 }
        })
      }
    );

    const data = await geminiRes.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return res.status(500).json({ error: 'Empty response', debug: JSON.stringify(data).slice(0, 500) });

    // Extract JSON block and sanitize
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'No JSON found', raw: raw.slice(0, 300) });

    // Fix common JSON issues from LLM output
    let cleaned = match[0]
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')  // remove control chars
      .replace(/,\s*}/g, '}')                           // trailing commas
      .replace(/,\s*]/g, ']');                          // trailing commas in arrays

    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) return res.status(400).json({ error: 'Missing imageData or mimeType' });

    const prompt = `You are an expert forensic image analyst. Analyze this image for signs of AI generation.
You MUST respond with ONLY a valid JSON object. No markdown. No code fences. No explanation. Just the JSON.
Use this exact structure:
{"verdict":"AI_GENERATED","confidence":85,"ai_probability":85,"authentic_probability":15,"indicators":[{"type":"ai","text":"observation here"},{"type":"real","text":"observation here"}],"summary":"2-3 sentence plain text analysis here"}
Rules:
- verdict: exactly one of AI_GENERATED, AUTHENTIC, UNCERTAIN
- confidence, ai_probability, authentic_probability: integers 0-100
- indicators: 4 to 6 items, type must be exactly ai, real, or neutral
- summary: plain text, no quotes inside, max 200 characters
- Do not include any text before or after the JSON`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.0, responseMimeType: 'application/json' }
        })
      }
    );

    const data = await geminiRes.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

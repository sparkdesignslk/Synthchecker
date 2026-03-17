export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) return res.status(400).json({ error: 'Missing imageData or mimeType' });

    const prompt = `You are an expert forensic image analyst. Analyze this image for signs of AI generation. Respond ONLY with a raw JSON object, no markdown, no extra text:
{"verdict":"AI_GENERATED","confidence":85,"ai_probability":85,"authentic_probability":15,"indicators":[{"type":"ai","text":"observation"}],"summary":"2-3 sentence analysis"}
verdict must be one of: AI_GENERATED, AUTHENTIC, UNCERTAIN. Include 4-6 indicators. type must be one of: ai, real, neutral.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.1 }
        })
      }
    );

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

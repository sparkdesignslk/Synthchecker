export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) return res.status(400).json({ error: 'Missing imageData or mimeType' });

    const prompt = `You are an expert forensic image analyst. Analyze this image for signs of AI generation.
Respond with ONLY a valid JSON object, no markdown, no code fences, no extra text before or after.
Use this exact structure:
{"verdict":"AI_GENERATED","confidence":85,"ai_probability":85,"authentic_probability":15,"indicators":[{"type":"ai","text":"observation"},{"type":"real","text":"observation"}],"summary":"plain text summary under 150 chars"}
Rules: verdict must be AI_GENERATED, AUTHENTIC, or UNCERTAIN. Include 4-6 indicators. type must be ai, real, or neutral. No quotes or special characters inside text or summary strings.`;

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

    let raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Extract JSON object if wrapped in anything
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'No JSON found in response: ' + raw.slice(0, 200) });
    const parsed = JSON.parse(match[0]);
    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

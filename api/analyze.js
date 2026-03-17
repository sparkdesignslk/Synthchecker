export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) return res.status(400).json({ error: 'Missing imageData or mimeType' });

    const prompt = `You are a forensic AI image detection expert. Analyze this image and determine if it is AI generated or a real photograph.

Look for AI tells: perfect skin, blurry backgrounds, extra fingers, asymmetric faces, unnatural lighting, watercolor textures, garbled text, glassy eyes, hair merging into background.
Look for real photo tells: natural grain, consistent shadows, authentic imperfections, realistic depth of field, natural skin texture.

You MUST pick AI_GENERATED or AUTHENTIC. Only use UNCERTAIN if the image is abstract or completely unidentifiable.

Reply with ONLY the following JSON, no other text, no markdown:
{"verdict":"AI_GENERATED","confidence":85,"ai_probability":85,"authentic_probability":15,"indicators":[{"type":"ai","text":"observation"},{"type":"ai","text":"observation"},{"type":"real","text":"observation"},{"type":"neutral","text":"observation"}],"summary":"one sentence conclusion"}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.0 }
        })
      }
    );

    const data = await geminiRes.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return res.status(500).json({ error: 'Empty response', debug: JSON.stringify(data).slice(0, 500) });

    // Log raw for debugging
    console.log('RAW GEMINI:', raw);

    let parsed = null;
    try { parsed = JSON.parse(raw.trim()); } catch {}
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*?\}/);
      if (match) {
        try { parsed = JSON.parse(match[0]); } catch {}
      }
    }
    if (!parsed) {
      // Return raw so we can see what Gemini is sending
      return res.status(500).json({ error: 'Could not parse response', raw: raw.slice(0, 500) });
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

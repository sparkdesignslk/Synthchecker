export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) return res.status(400).json({ error: 'Missing imageData or mimeType' });

    const prompt = `You are a forensic AI image detection expert. Your job is to decide if this image was AI generated or is a real photograph. You MUST give a definitive verdict — never say uncertain unless the image is completely unrecognizable.

Look for these AI tells: perfect skin with no pores, blurry or melting backgrounds, extra or missing fingers, asymmetric facial features, unnatural lighting, watercolor-like textures, garbled text, floating objects, eyes that look glassy or identical, hair that merges into background, accessories that look painted on.

Look for these real photo tells: natural grain and noise, consistent shadows, authentic imperfections, realistic depth of field, natural skin texture, normal background detail.

You MUST pick AI_GENERATED or AUTHENTIC. Only use UNCERTAIN if the image is abstract art, a solid color, or completely unidentifiable.

Reply with ONLY this JSON object, no other text:
{"verdict":"AI_GENERATED","confidence":85,"ai_probability":85,"authentic_probability":15,"indicators":[{"type":"ai","text":"specific observation"},{"type":"ai","text":"specific observation"},{"type":"real","text":"specific observation"},{"type":"neutral","text":"specific observation"}],"summary":"Definitive one sentence conclusion"}`;

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
    if (!raw) return res.status(500).json({ error: 'Empty response from Gemini' });

    let parsed = null;
    try { parsed = JSON.parse(raw.trim()); } catch {}
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']'));
        } catch {}
      }
    }
    if (!parsed) {
      parsed = {
        verdict: 'UNCERTAIN',
        confidence: 50,
        ai_probability: 50,
        authentic_probability: 50,
        indicators: [{ type: 'neutral', text: 'Could not parse analysis result' }],
        summary: raw.slice(0, 200)
      };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;
    if (!imageData || !mimeType) return res.status(400).json({ error: 'Missing imageData or mimeType' });

    const prompt = `Analyze this image and determine if it is AI generated or a real photograph.
Reply with ONLY this JSON, filling in the values. Do not write anything else, no markdown, no explanation:
{"verdict":"AI_GENERATED","confidence":80,"ai_probability":80,"authentic_probability":20,"indicators":[{"type":"ai","text":"describe what you see"},{"type":"real","text":"describe what you see"},{"type":"neutral","text":"describe what you see"},{"type":"ai","text":"describe what you see"}],"summary":"One or two sentences about your conclusion"}
Replace AI_GENERATED with AUTHENTIC if it looks real, or UNCERTAIN if unsure.`;

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

    // Try multiple extraction strategies
    let parsed = null;

    // Strategy 1: direct parse
    try { parsed = JSON.parse(raw.trim()); } catch {}

    // Strategy 2: extract first JSON block
    if (!parsed) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          const cleaned = match[0]
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ')
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']');
          parsed = JSON.parse(cleaned);
        } catch {}
      }
    }

    // Strategy 3: fallback with raw text as summary
    if (!parsed) {
      parsed = {
        verdict: 'UNCERTAIN',
        confidence: 50,
        ai_probability: 50,
        authentic_probability: 50,
        indicators: [{ type: 'neutral', text: 'Analysis completed but result format was unexpected' }],
        summary: raw.slice(0, 200)
      };
    }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

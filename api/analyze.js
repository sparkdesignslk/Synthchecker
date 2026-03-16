export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageData, mimeType } = req.body;

    const prompt = `You are an expert forensic image analyst specializing in detecting AI-generated images. Analyze the provided image and respond ONLY with a JSON object in this exact format, no markdown, no extra text:
{"verdict":"AI_GENERATED","confidence":85,"ai_probability":85,"authentic_probability":15,"indicators":[{"type":"ai","text":"observation here"}],"summary":"2-3 sentence analysis here"}

verdict must be exactly one of: AI_GENERATED, AUTHENTIC, UNCERTAIN
Include 4-6 specific technical indicators (texture anomalies, lighting, anatomy, noise patterns, etc).
type for each indicator must be exactly one of: ai, real, neutral`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageData } }
            ]
          }],
          generationConfig: { maxOutputTokens: 1000, temperature: 0.1 }
        })
      }
    );

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let parsed;
    try { parsed = JSON.parse(raw.replace(/```json|```/g, '').trim()); }
    catch { throw new Error('Failed to parse response: ' + raw.slice(0, 200)); }

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// netlify/functions/tts.js
// Text-to-Speech for GodsEye audio briefings
// Uses OpenAI TTS-1 API — requires OPENAI_API_KEY in Netlify env vars
// Returns MP3 audio blob

exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "OPENAI_API_KEY not set in environment variables" }),
    };
  }

  try {
    const { text, voice, speed } = JSON.parse(event.body);

    if (!text || text.length < 10) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Text too short" }),
      };
    }

    // Cap at 4096 chars (OpenAI TTS limit)
    const input = text.substring(0, 4096);

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "tts-1",
        input: input,
        voice: voice || "onyx", // onyx = deep, authoritative. Options: alloy, echo, fable, onyx, nova, shimmer
        speed: speed || 0.95, // slightly slower for briefing clarity
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenAI TTS error:", err);
      return {
        statusCode: response.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "OpenAI TTS failed: " + response.status }),
      };
    }

    const audioBuffer = await response.arrayBuffer();

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": "inline; filename=godseye-briefing.mp3",
        "Cache-Control": "no-cache",
      },
      body: Buffer.from(audioBuffer).toString("base64"),
      isBase64Encoded: true,
    };

  } catch (err) {
    console.error("TTS function error:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};

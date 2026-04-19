// Ask GodsEye proxy — forwards browser requests to Anthropic API with server-side key
exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "POST only" }) };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers, body: JSON.stringify({ error: "ANTHROPIC_API_KEY not set in Netlify env" }) };

  try {
    const body = JSON.parse(event.body || "{}");
    const { system, question, model } = body;
    if (!question) return { statusCode: 400, headers, body: JSON.stringify({ error: "question required" }) };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-4-20250514",
        max_tokens: 1200,
        system: system || "You are GodsEye, a geopolitical intelligence framework.",
        messages: [{ role: "user", content: question }]
      })
    });

    const data = await resp.json();
    if (!resp.ok) return { statusCode: 200, headers, body: JSON.stringify({ error: "Anthropic API " + resp.status, detail: data }) };

    let text = "";
    if (data.content) data.content.forEach(c => { if (c.type === "text") text += c.text; });
    return { statusCode: 200, headers, body: JSON.stringify({ text, usage: data.usage, model: data.model }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: err.message }) };
  }
};

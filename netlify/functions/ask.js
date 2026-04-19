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
    const { system, query, question, model } = body;
    const q = query || question;
    if (!q) return { statusCode: 400, headers, body: JSON.stringify({ error: "query or question required" }) };

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
        messages: [{ role: "user", content: q }]
      })
    });

    const data = await resp.json();
    if (!resp.ok) return { statusCode: 200, headers, body: JSON.stringify({ answer: "API error: " + resp.status + " - " + JSON.stringify(data) }) };

    let answer = "";
    if (data.content) data.content.forEach(c => { if (c.type === "text") answer += c.text; });
    if (!answer) answer = "No response from Claude";
    return { statusCode: 200, headers, body: JSON.stringify({ answer, usage: data.usage, model: data.model }) };
  } catch (err) {
    return { statusCode: 200, headers, body: JSON.stringify({ answer: "Error: " + err.message }) };
  }
};

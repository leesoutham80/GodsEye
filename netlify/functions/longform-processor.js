// netlify/functions/longform-processor.js
// Processes queued podcasts/articles with Claude Opus for meta-analysis
// Extracts contradictions, blind spots, opposing signals, systemic insights
// Max 3 items per run for cost control (~$0.50/day)

const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Cache-Control": "no-cache"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    console.warn("[LONGFORM] No ANTHROPIC_API_KEY");
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "API key not configured" })
    };
  }

  try {
    const store = getStore({
      name: "godseye-state",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.Godseye_Blobs
    });

    // Load queue
    const queueRaw = await store.get("longform_queue").catch(() => null);
    if (!queueRaw) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ processed: 0, message: "Queue is empty" })
      };
    }

    const queue = JSON.parse(queueRaw);
    if (!queue || queue.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ processed: 0, message: "Queue is empty" })
      };
    }

    // Process max 3 items
    const toProcess = queue.slice(0, 3);
    const remaining = queue.slice(3);
    const results = [];

    console.log("[LONGFORM] Processing", toProcess.length, "items");

    for (const item of toProcess) {
      try {
        let content = "";

        // Extract content based on type
        if (item.type === "youtube") {
          // Try to get transcript
          const videoId = item.url.match(/(?:v=|\/)([\w-]{11})/)?.[1];
          if (videoId) {
            try {
              const transcriptUrl = `https://www.youtube.com/watch?v=${videoId}`;
              const response = await fetch(transcriptUrl);
              const html = await response.text();
              
              // Extract transcript from captions track
              const captionsMatch = html.match(/"captions".*?"playerCaptionsTracklistRenderer":\{"captionTracks":\[(\{[^}]+\})/);
              if (captionsMatch) {
                const track = JSON.parse(captionsMatch[1]);
                if (track.baseUrl) {
                  const captionsResp = await fetch(track.baseUrl);
                  const captionsXml = await captionsResp.text();
                  const textMatches = captionsXml.match(/<text[^>]*>(.*?)<\/text>/g) || [];
                  content = textMatches.map(t => t.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&")).join(" ").substring(0, 50000);
                }
              }
            } catch (e) {
              console.warn("[LONGFORM] Transcript extraction failed:", e.message);
            }
          }
        } else if (item.type === "article") {
          // Fetch article text
          try {
            const response = await fetch(item.url, { headers: { "User-Agent": "GodsEye/2.0" }, signal: AbortSignal.timeout(10000) });
            if (response.ok) {
              const html = await response.text();
              // Strip HTML tags and extract text
              content = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
                .replace(/<[^>]+>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .substring(0, 50000);
            }
          } catch (e) {
            console.warn("[LONGFORM] Article fetch failed:", e.message);
          }
        }

        if (!content || content.length < 500) {
          console.warn("[LONGFORM] Insufficient content for", item.title);
          continue;
        }

        // Analyze with Opus
        const opusPrompt = `You are analyzing content for GodsEye, a geopolitical risk intelligence system tracking the Strait of Hormuz crisis. GodsEye uses 131 signals across 7 clusters (A:Military, B:Shipping, C:Markets, D:Diplomatic, E:Supply, F:Technical, G:Humanitarian, D8:Political Theology).

Your task: Find meta-intelligence — things the signal framework might be missing or getting wrong.

Content to analyze:
${content}

Return ONLY valid JSON with this exact structure (no markdown, no preamble):
{
  "contradictions": [
    {
      "signal_id": "S83",
      "signal_name": "IRGC Degradation",
      "current_assumption": "IRGC capacity drops with each strike",
      "expert_claim": "IRGC replaces units within 48hrs, degradation is performative",
      "confidence": "high",
      "impact": "Model undercounts Iranian resilience"
    }
  ],
  "blind_spots": [
    {
      "topic": "Egyptian grain hoarding",
      "why_missing": "Mentioned 3x as Suez closure buffer strategy but not tracked",
      "proposed_signal": {
        "id": "S132",
        "name": "Regional Food Hoarding Index",
        "cluster": "E"
      }
    }
  ],
  "opposing_signals": [
    {
      "existing_signal": "S110",
      "existing_name": "Helium Supply Disruption",
      "proposed_opposite": {
        "id": "S133",
        "name": "Alternative Helium Activation",
        "rationale": "US strategic reserve can offset shortfall"
      }
    }
  ],
  "systemic_insights": [
    {
      "pattern": "Insurance withdrew 3 days BEFORE strike, not after",
      "implication": "S6/S74 timing model is inverted — insurance has inside intelligence"
    }
  ]
}

If none found in a category, use empty array. Max 3 items per category.`;

        const opusResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-opus-4-20250514",
            max_tokens: 4000,
            messages: [{
              role: "user",
              content: opusPrompt
            }]
          })
        });

        if (!opusResponse.ok) {
          console.error("[LONGFORM] Opus API error:", opusResponse.status);
          continue;
        }

        const opusData = await opusResponse.json();
        const analysisText = opusData.content[0].text;
        
        // Parse JSON response
        let analysis;
        try {
          analysis = JSON.parse(analysisText);
        } catch (e) {
          // Try to extract JSON from markdown fences
          const jsonMatch = analysisText.match(/```json\n([\s\S]+?)\n```/) || analysisText.match(/\{[\s\S]+\}/);
          if (jsonMatch) {
            analysis = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          } else {
            console.error("[LONGFORM] Failed to parse Opus response");
            continue;
          }
        }

        results.push({
          ts: new Date().toISOString(),
          title: item.title,
          url: item.url,
          type: item.type,
          analysis: analysis
        });

        console.log("[LONGFORM] Analyzed:", item.title);

      } catch (e) {
        console.error("[LONGFORM] Processing error for", item.title, ":", e.message);
      }
    }

    // Save results to meta_intel store key
    if (results.length > 0) {
      const existingRaw = await store.get("meta_intel").catch(() => null);
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [...results, ...existing].slice(0, 50); // Keep last 50
      await store.set("meta_intel", JSON.stringify(updated));
      console.log("[LONGFORM] Saved", results.length, "analyses");
    }

    // Update queue
    await store.set("longform_queue", JSON.stringify(remaining));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        processed: results.length,
        remaining: remaining.length,
        message: `Processed ${results.length} items`
      })
    };

  } catch (err) {
    console.error("[LONGFORM] Handler error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: err.message,
        stack: err.stack,
        name: err.name
      })
    };
  }
};

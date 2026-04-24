// netlify/functions/longform-processor.js
// Processes queued podcasts/long articles with Claude Opus for meta-intelligence

const { getStore } = require("@netlify/blobs");

// YouTube Transcript API helper
async function getYouTubeTranscript(videoId) {
  try {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const response = await fetch(`https://youtube-transcript-api.vercel.app/api/transcript?url=${encodeURIComponent(url)}`);
    if (!response.ok) return null;
    
    const data = await response.json();
    if (!data.transcript) return null;
    
    // Combine transcript segments
    return data.transcript.map(t => t.text).join(' ');
  } catch (e) {
    console.warn('[LONGFORM] YouTube transcript failed:', e.message);
    return null;
  }
}

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Fetch article text from URL
async function fetchArticleText(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'GodsEye/2.0' },
      signal: AbortSignal.timeout(10000)
    });
    
    if (!response.ok) return null;
    const html = await response.text();
    
    // Basic text extraction - strip HTML tags and clean
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Take first ~15000 chars (roughly 3000 words)
    return text.substring(0, 15000);
  } catch (e) {
    console.warn('[LONGFORM] Article fetch failed:', e.message);
    return null;
  }
}

// Analyze with Claude Opus
async function analyzeWithOpus(content, metadata, anthropicKey) {
  const crisisDay = Math.floor((Date.now() - new Date("2026-02-28").getTime()) / 86400000);
  
  const prompt = `You are GodsEye's meta-intelligence analyst. Your role is to identify blind spots and contradictions in the GodsEye signal framework by analyzing expert content.

CONTENT TYPE: ${metadata.isAudio ? 'Podcast' : 'Article'}
SOURCE: ${metadata.source}
TITLE: ${metadata.title}
CRISIS DAY: ${crisisDay}

GodsEye tracks the 2026 Hormuz crisis through 131 signals across 8 clusters:
- Cluster A: Military/Kinetic (S1 Strike Tempo, S1b Theatre Util, S27 Force Posture, etc.)
- Cluster B: Shipping/Maritime (S3 Transit, S15 Convoy, S33 VLCC Freight, etc.)
- Cluster C: Market/Financial (S7 Brent Curve, S8 Tanker Equity, S21 Options IV, etc.)
- Cluster D: Diplomatic/Narrative (S10 Narrative Softening, S12 Mediator Framework, S123 Qatari Media Tempo, S129 Crown Intervention, etc.)
- Cluster D8: Political Theology (S112 Karbala Paradigm, S113 Temple Mount, S114 Time Horizon Divergence, S124 Iranian Honorific Escalation)
- Cluster E: Supply Chain (S80a Food Stress, S110 Helium, S111 Fertiliser, etc.)
- Cluster F: Cyber/Infrastructure (S35 Infra War, S87 Subsea Cable, S128 Digital Chokepoint Signalling, etc.)
- Shadow Layer: S101-S108 (dark fleet, shadow revenue, etc.)

YOUR TASK: Extract high-alpha intelligence that GodsEye is systematically missing.

Return ONLY valid JSON in this exact structure:
{
  "contradictions": [
    {
      "signal_id": "S83",
      "signal_name": "IRGC Degradation",
      "current_assumption": "IRGC degrading under strike pressure",
      "expert_claim": "IRGC units replaced within 48hrs, degradation is performative",
      "evidence": "Specific quote or data point from content",
      "confidence": "high|medium|low",
      "impact": "If true, S83 overcounts real attrition"
    }
  ],
  "blind_spots": [
    {
      "topic": "Egyptian grain hoarding",
      "frequency": "mentioned 3 times across 15 min discussion",
      "why_missing": "No signal tracks regional food stockpiling behavior",
      "proposed_signal": {
        "id": "S132",
        "name": "Regional Food Hoarding Index",
        "cluster": "E",
        "rationale": "Egypt/Turkey hoarding compounds Gulf disruption, creates secondary shortage"
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
        "cluster": "E",
        "rationale": "US has strategic helium reserve in Amarillo TX. Expert explains release mechanism can offset 30% of Qatar disruption within 60 days."
      }
    }
  ],
  "systemic_insights": [
    {
      "pattern": "Insurance withdrawal preceded strike by 3 days, not followed it",
      "implication": "S6/S74 timing assumptions inverted - market front-runs kinetic, doesn't react to it",
      "affected_signals": ["S6", "S74"],
      "framework_fix": "Add T-3 day leading indicator logic to insurance cluster"
    }
  ],
  "expert_disagreements": [
    {
      "topic": "Iran exit timeline",
      "position_a": "Economic pressure forces capitulation within 90 days",
      "position_b": "Karbala Paradigm means pressure feeds resolve, timeline extends to 180+ days",
      "source_a": "Western analyst consensus",
      "source_b": "Iran specialist citing theological utility function",
      "godseye_position": "Tracks Karbala Paradigm (S112) but most analysts assume pressure=capitulation",
      "epistemic_flag": "Major disagreement on core mechanism - GodsEye should track both models"
    }
  ]
}

If a category has no findings, return empty array [].
Focus on HIGH-ALPHA insights - things that would materially change GodsEye's analysis if true.
Ignore generic commentary. Extract SPECIFIC claims with SPECIFIC evidence.

CONTENT:
${content}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-opus-4-6-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Opus API error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const text = data.content.map(c => c.text || '').join('');
    
    // Strip markdown fences if present
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    return JSON.parse(cleaned);
  } catch (e) {
    console.error('[LONGFORM] Opus analysis failed:', e);
    return null;
  }
}

// Main handler
exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "No API key configured" })
    };
  }

  try {
    const metaStore = getStore("godseye-meta");
    
    // Load queue
    const queueRaw = await metaStore.get("longform_queue").catch(() => null);
    
    if (!queueRaw) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "Queue empty", processed: 0 })
      };
    }

    const queue = JSON.parse(queueRaw);
    
    // Get unprocessed items (max 3 per run to control Opus costs)
    const pending = queue.filter(item => !item.processed).slice(0, 3);
    
    if (pending.length === 0) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ message: "All items processed", total: queue.length })
      };
    }

    console.log(`[LONGFORM] Processing ${pending.length} items`);

    const results = [];

    for (const item of pending) {
      console.log(`[LONGFORM] Processing: ${item.text}`);
      
      let content = null;
      
      // Try to get transcript/article
      if (item.audioUrl || item.url?.includes('youtube.com') || item.url?.includes('youtu.be')) {
        const videoId = extractYouTubeId(item.url || item.audioUrl);
        if (videoId) {
          content = await getYouTubeTranscript(videoId);
        }
      }
      
      // If not audio or transcript failed, try article fetch
      if (!content && item.url) {
        content = await fetchArticleText(item.url);
      }

      if (!content) {
        console.warn(`[LONGFORM] Could not extract content for: ${item.text}`);
        item.processed = true;
        item.processed_at = new Date().toISOString();
        item.status = "failed_extraction";
        continue;
      }

      // Analyze with Opus
      const analysis = await analyzeWithOpus(content, {
        title: item.text,
        source: item.origin,
        isAudio: !!item.audioUrl
      }, anthropicKey);

      if (!analysis) {
        console.warn(`[LONGFORM] Opus analysis failed for: ${item.text}`);
        item.processed = true;
        item.processed_at = new Date().toISOString();
        item.status = "failed_analysis";
        continue;
      }

      // Mark as processed and store result
      item.processed = true;
      item.processed_at = new Date().toISOString();
      item.status = "complete";
      item.analysis = analysis;

      results.push({
        title: item.text,
        source: item.origin,
        url: item.url,
        analysis: analysis
      });

      console.log(`[LONGFORM] ✓ Completed: ${item.text}`);
    }

    // Save updated queue
    await metaStore.set("longform_queue", JSON.stringify(queue));

    // Store meta-intel results
    const intelRaw = await metaStore.get("meta_intel").catch(() => null);
    const intel = intelRaw ? JSON.parse(intelRaw) : [];
    
    results.forEach(r => {
      intel.push({
        ts: new Date().toISOString(),
        ...r
      });
    });

    await metaStore.set("meta_intel", JSON.stringify(intel));

    console.log(`[LONGFORM] Stored ${results.length} meta-intel results`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        processed: results.length,
        pending: queue.filter(i => !i.processed).length,
        total: queue.length,
        results: results
      })
    };

  } catch (err) {
    console.error("[LONGFORM] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};

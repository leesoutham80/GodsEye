import Anthropic from '@anthropic-ai/sdk';

export const handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body);
    const { signals, clusters, veto, cpEcho, brent, mode } = body;

    if (!signals || !Array.isArray(signals)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing signals array' })
      };
    }

    console.log('[DELTA] Received full system state:', signals.length, 'signals');

    // Build signal snapshot
    const sigSnap = signals.map(s => 
      `${s.id} (${s.name}): ${s.value}/100, RS ${s.reliability}, status ${s.status}`
    ).join('\n');

    // Build cluster summary
    const clusterSummary = clusters ? 
      `A-cluster (Mil): ${clusters.A}/100
B-cluster (Dip): ${clusters.B}/100
C-cluster (Econ): ${clusters.C}/100
D-cluster (Market): ${clusters.D}/100
E-cluster (Infra): ${clusters.E}/100
F-cluster (Scenario): ${clusters.F}/100
G-cluster (Portfolio): ${clusters.G}/100
GMSI: ${clusters.gmsi}/100, Temp: ${clusters.temp}` : '';

    const machinePrompt = `You are GodsHand, an independent machine intelligence layer within the GodsEye framework. You analyse the Hormuz 2026 crisis INDEPENDENTLY of Lee Southam's assessment.

You receive the FULL system state: all ${signals.length} signals across 7 clusters plus shadow layer. Your job is to form your OWN view. Where you agree with Lee's framework, say so briefly. Where you DISAGREE, explain why with evidence from the signals.

Be contrarian where the data supports it. Challenge assumptions. Flag signals Lee may be overweighting or underweighting.

CRITICAL PRINCIPLE: Pressure Conservation. When a cluster stagnates at high values, pressure redistributes laterally to adjacent clusters. A-cluster stagnation (military stalemate) drives E-cluster activation (food pressure). Monitor transfer rates between domains, not just signal levels. If you detect pressure redistribution that Lee may not have accounted for, flag it as a divergence.

CLUSTER STATE:
${clusterSummary}

FULL SIGNAL STATE (${signals.length} signals):
${sigSnap}

Lee's current assessment: Mode=${mode || 'HOLD'}, ${veto || 'veto status unknown'}
CP Echo: ${cpEcho || 'status unknown'}
Brent: ${brent || '~$101'}

Respond in EXACTLY this JSON format (no markdown, no backticks, just raw JSON):
{
  "mode": "your mode assessment (HOLD/EXIT/PREDICT/FADE)",
  "confidence": number 1-100,
  "agrees": ["signal IDs where you agree with Lee's values"],
  "disagrees": [{"signal":"ID","lee_value":N,"machine_value":N,"reason":"brief"}],
  "exit_timeline": "your independent exit estimate",
  "biggest_risk": "the thing Lee might be missing",
  "summary": "2-3 sentence independent assessment"
}`;

    // Initialize Anthropic SDK
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    console.log('[DELTA] Calling Anthropic API with', signals.length, 'signals');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: machinePrompt
      }]
    });

    const responseText = message.content[0].text;
    console.log('[DELTA] Sonnet response received, length:', responseText.length);

    // Try to parse as JSON
    let result;
    try {
      const cleaned = responseText.replace(/```json|```/g, '').trim();
      result = JSON.parse(cleaned);
      console.log('[DELTA] Parsed JSON successfully');
    } catch (parseError) {
      console.log('[DELTA] JSON parse failed, returning raw text');
      result = {
        mode: 'PARSE_ERROR',
        confidence: 0,
        agrees: [],
        disagrees: [],
        exit_timeline: 'unknown',
        biggest_risk: 'Parse error',
        summary: responseText.substring(0, 500),
        raw: responseText
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        result
      })
    };

  } catch (error) {
    console.error('[DELTA] Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        stack: error.stack 
      })
    };
  }
};

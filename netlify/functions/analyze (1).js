const Anthropic = require('@anthropic-ai/sdk');

exports.handler = async (event, context) => {
  try {
    const body = JSON.parse(event.body);
    const { headlines, signals, crisisDay, gmsi, mode, scenarios } = body;
    
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: false,
          error: 'No API key configured',
          impacts: []
        })
      };
    }
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Build signal summary for context
    const topSignals = Object.entries(signals)
      .filter(([id, val]) => val >= 60)
      .map(([id, val]) => `${id}:${val}`)
      .join(', ');
    
    const prompt = `You are GodsEye's signal analysis engine. Analyze these headlines from the Hormuz crisis (Day ${crisisDay}, GMSI ${gmsi}, Mode ${mode}).

HEADLINES:
${headlines.map((h, i) => `${i+1}. [${h.tag}] ${h.text}`).join('\n')}

CURRENT HIGH SIGNALS (≥60):
${topSignals || 'None above 60'}

SCENARIO PROBABILITIES:
Path A (Prolonged): ${scenarios.A}%, Path B (Escort): ${scenarios.B}%, Path C (Diplomatic): ${scenarios.C}%, Path E (Extreme): ${scenarios.E}%, Path F (SAR): ${scenarios.F}%

TASK: For each headline, identify which signals it impacts and how. Output ONLY valid JSON in this exact format:
{
  "impacts": [
    {
      "headline_index": 1,
      "signals": [
        {
          "id": "S1",
          "direction": "up",
          "magnitude": "moderate",
          "reason": "Strike activity reported",
          "suggested_value": 65
        }
      ],
      "taco_phase": null,
      "scenario_impact": null
    }
  ]
}

SIGNAL IDs: S1 (Strike Tempo), S3 (Transit Count), S6 (Insurance), S10 (Narrative Softening), S12 (Mediator), S15 (Convoy), S83 (IRGC Degradation), S91 (Nuclear Risk), S121 (Gulf CDS), S122 (Options Skew)

DIRECTIONS: "up", "down", "flat"
MAGNITUDES: "minor", "moderate", "significant", "critical"

Only include clear, actionable impacts. If a headline has no signal impact, omit it.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const responseText = message.content[0].text;
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    if (responseText.includes('```json')) {
      jsonText = responseText.split('```json')[1].split('```')[0].trim();
    } else if (responseText.includes('```')) {
      jsonText = responseText.split('```')[1].split('```')[0].trim();
    }
    
    const analysis = JSON.parse(jsonText);
    
    // Auto-apply conservative signal updates
    const autoApplied = {};
    let appliedCount = 0;
    
    if (analysis.impacts) {
      analysis.impacts.forEach(impact => {
        if (impact.signals) {
          impact.signals.forEach(sig => {
            // Auto-apply only if:
            // 1. Magnitude is moderate or higher
            // 2. Suggested value provided
            // 3. Direction is clear
            if (sig.suggested_value && sig.magnitude !== 'minor' && sig.direction !== 'flat') {
              const currentVal = signals[sig.id] || 0;
              const suggested = sig.suggested_value;
              
              // Conservative bounds: don't move more than 15 points per update
              let newVal = suggested;
              if (Math.abs(suggested - currentVal) > 15) {
                newVal = sig.direction === 'up' 
                  ? currentVal + 15 
                  : currentVal - 15;
              }
              
              // Clamp to 0-100
              newVal = Math.max(0, Math.min(100, newVal));
              
              autoApplied[sig.id] = newVal;
              appliedCount++;
            }
          });
        }
      });
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify({
        success: true,
        source: 'claude-haiku-3.5',
        impacts: analysis.impacts || [],
        auto_applied: autoApplied,
        applied_count: appliedCount,
        timestamp: new Date().toISOString()
      })
    };
    
  } catch (error) {
    console.error('[ANALYZE] Error:', error);
    return {
      statusCode: 200, // Return 200 even on error to avoid breaking client
      body: JSON.stringify({
        success: false,
        error: error.message,
        impacts: []
      })
    };
  }
};

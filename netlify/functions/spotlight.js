// Try to load dependencies, but don't crash if they fail
let getStore, Anthropic;
try {
  ({ getStore } = require('@netlify/blobs'));
  Anthropic = require('@anthropic-ai/sdk');
} catch (depError) {
  console.error('[SPOTLIGHT] Dependency load failed:', depError.message);
}

exports.handler = async (event, context) => {
  // CRITICAL: Always return valid JSON with headers, no matter what
  const safeReturn = (statusCode, data) => ({
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify(data)
  });
  
  // If dependencies failed to load, return error immediately
  if (!Anthropic) {
    return safeReturn(500, {
      success: false,
      error: 'Spotlight function dependencies not installed - check package.json deployed correctly',
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Try to fetch latest cached analysis first (if Blobs is configured)
    let cachedData = null;
    if (getStore) {
      try {
        // Pass context to getStore for proper Netlify environment detection
        const store = getStore({
          name: 'godseye-spotlight',
          siteID: context.siteId || process.env.SITE_ID,
          token: context.token || process.env.NETLIFY_BLOBS_CONTEXT
        });
        const latest = await store.get('latest');
        if (latest) {
          cachedData = JSON.parse(latest);
          
          // If cache is fresh (< 6 hours), return it immediately
          const cacheAge = Date.now() - new Date(cachedData.timestamp).getTime();
          if (cacheAge < 6 * 3600 * 1000) {
            console.log('[SPOTLIGHT] Returning cached analysis, age:', Math.floor(cacheAge/60000), 'minutes');
            return safeReturn(200, cachedData);
          }
        }
      } catch (blobError) {
        console.log('[SPOTLIGHT] No cached data available:', blobError.message);
      }
    }
    
    // No cache or stale cache - generate new analysis
    let signals = [];
    
    // Check if this is a manual trigger with signal data
    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        signals = body.signals || [];
      } catch (e) {
        console.warn('[SPOTLIGHT] No signal data in request body');
      }
    }
    
    // If no signals provided, fetch from signals.json
    if (signals.length === 0) {
      const fetch = require('node-fetch');
      const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://godseye-v-60.netlify.app';
      console.log('[SPOTLIGHT] Fetching signals from:', siteUrl + '/signals.json');
      
      try {
        const res = await fetch(siteUrl + '/signals.json');
        if (res.ok) {
          const data = await res.json();
          if (data.signals) {
            signals = data.signals;
          }
        }
      } catch (fetchError) {
        console.error('[SPOTLIGHT] Failed to fetch signals.json:', fetchError.message);
      }
    }
    
    if (signals.length === 0) {
      return safeReturn(400, { 
        success: false,
        error: 'No signal data available - check signals.json is deployed',
        timestamp: new Date().toISOString()
      });
    }
    
    // Calculate regime sensitivity and composite score for each signal
    // Top signals = high value × high reliability × status LIVE
    const scored = signals
      .filter(s => s.status === 'LIVE' && s.value > 0)
      .map(s => ({
        id: s.id,
        name: s.name,
        cluster: s.cluster,
        value: s.value,
        reliability: s.reliability,
        // Composite score: value weighted by reliability, boosted if maxed
        score: s.value * s.reliability * (s.value >= 90 ? 1.2 : 1.0)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    
    console.log('[SPOTLIGHT] Scored', scored.length, 'signals from', signals.length, 'total');
    
    if (scored.length === 0) {
      return safeReturn(200, {
        success: true,
        timestamp: new Date().toISOString(),
        top_signals: [],
        analyses: [],
        catalysts: [],
        keywords_generated: 0,
        error: 'No LIVE signals with value > 0 found',
        source: 'no-data'
      });
    }
    
    if (!process.env.ANTHROPIC_API_KEY) {
      return safeReturn(200, {
        success: true,
        timestamp: new Date().toISOString(),
        top_signals: scored.map(s => ({ id: s.id, name: s.name, value: s.value })),
        analyses: [],
        catalysts: [],
        keywords_generated: 0,
        error: 'ANTHROPIC_API_KEY not configured in Netlify environment variables',
        source: 'no-api-fallback'
      });
    }
    
    console.log('[SPOTLIGHT] Initializing Anthropic SDK');
    
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });
    
    // Build prompt for Haiku analysis
    const signalList = scored.map((s, i) => 
      `${i+1}. ${s.id} (${s.name}): ${s.value}/100, reliability ${s.reliability}`
    ).join('\n');
    
    const prompt = `You are GodsEye's signal spotlight analyzer. The Hormuz crisis is ongoing. Analyze these top 5 signals and explain their current importance.

TOP SIGNALS RIGHT NOW:
${signalList}

For EACH signal, provide:
1. WHY it matters right now (2-3 sentences, specific to current crisis state)
2. WHEN the next inflection point is (specific date/timeframe if detectable)
3. WHAT HAPPENS NEXT (the two most likely outcomes)

CRITICAL: If any signal analysis mentions specific upcoming events (meetings, deadlines, expiries, bulletins), note them explicitly.

Output ONLY valid JSON in this exact format:
{
  "analyses": [
    {
      "signal_id": "S122",
      "signal_name": "Brent Options Put/Call Skew",
      "why_now": "At 95/100, the skew shows maximum fear...",
      "when": "April 20 OPEC+ meeting",
      "what_next": "Either collapses to 60-70 within 72hrs as mediator frameworks gain traction, or spikes to 100 triggering circuit breakers",
      "catalysts_detected": ["OPEC+ emergency meeting April 20", "Saudi energy minister statement"]
    }
  ]
}

Be specific. Use actual dates when detectable. Identify concrete catalysts.`;

    let analysis = { analyses: [] };
    
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      const responseText = message.content[0].text;
      console.log('[SPOTLIGHT] Haiku response received, length:', responseText.length);
      
      // Extract JSON
      let jsonText = responseText;
      if (responseText.includes('```json')) {
        jsonText = responseText.split('```json')[1].split('```')[0].trim();
      } else if (responseText.includes('```')) {
        jsonText = responseText.split('```')[1].split('```')[0].trim();
      }
      
      analysis = JSON.parse(jsonText);
      console.log('[SPOTLIGHT] Parsed', analysis.analyses?.length || 0, 'signal analyses');
      
    } catch (apiError) {
      console.error('[SPOTLIGHT] API call or parsing failed:', apiError.message);
      // Continue with empty analyses - don't crash the whole function
    }
    
    // Extract all detected catalysts across all signals
    const allCatalysts = [];
    const catalystKeywords = [];
    
    if (analysis.analyses) {
      analysis.analyses.forEach(a => {
        if (a.catalysts_detected && Array.isArray(a.catalysts_detected)) {
          a.catalysts_detected.forEach(cat => {
            allCatalysts.push({
              event: cat,
              source_signal: a.signal_id,
              detected_at: new Date().toISOString()
            });
            
            // Generate keyword variations
            const keywords = generateKeywordVariations(cat);
            catalystKeywords.push(...keywords);
          });
        }
      });
    }
    
    // Build response data
    const timestamp = new Date().toISOString();
    const spotlightData = {
      success: true,
      timestamp,
      top_signals: scored,
      analyses: analysis.analyses || [],
      catalysts: allCatalysts,
      keywords_generated: [...new Set(catalystKeywords)].length,
      source: 'claude-sonnet-4'
    };
    
    // Try to store in Netlify Blobs for caching (optional)
    if (getStore) {
      try {
        const store = getStore({
          name: 'godseye-spotlight',
          siteID: context.siteId || process.env.SITE_ID,
          token: context.token || process.env.NETLIFY_BLOBS_CONTEXT
        });
        const key = `spotlight-${Date.now()}`;
        await store.set(key, JSON.stringify(spotlightData), {
          metadata: { timestamp }
        });
        
        // Also store as "latest" for easy client retrieval
        await store.set('latest', JSON.stringify(spotlightData));
        
        console.log('[SPOTLIGHT] Stored analysis in Blobs:', key);
      } catch (blobError) {
        console.log('[SPOTLIGHT] Blobs storage skipped:', blobError.message);
        // Continue anyway - analysis is still valid without caching
      }
    }
    
    return safeReturn(200, spotlightData);
    
  } catch (error) {
    console.error('[SPOTLIGHT] Error:', error);
    console.error('[SPOTLIGHT] Stack:', error.stack);
    return safeReturn(500, {
      success: false,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};

// Generate keyword variations for catalyst detection
function generateKeywordVariations(eventText) {
  const keywords = [];
  const lc = eventText.toLowerCase();
  
  // Extract key terms
  keywords.push(lc); // original
  
  // OPEC variations
  if (lc.includes('opec')) {
    keywords.push('opec plus', 'opec+', 'opec emergency', 'oil producers meeting', 
                  'vienna meeting', 'saudi uae talks', 'gulf producers');
  }
  
  // Meeting variations
  if (lc.includes('meeting')) {
    keywords.push(
      lc.replace('meeting', 'session'),
      lc.replace('meeting', 'summit'),
      lc.replace('meeting', 'talks'),
      lc.replace('meeting', 'conference')
    );
  }
  
  // Date extraction - if contains specific date, add variations
  const dateMatch = lc.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* \d+/);
  if (dateMatch) {
    const date = dateMatch[0];
    keywords.push(date, `${date} deadline`, `${date} expiry`);
  }
  
  // Ceasefire variations
  if (lc.includes('ceasefire')) {
    keywords.push('cease fire', 'truce', 'pause', 'cessation', 'armistice');
  }
  
  // Energy minister variations
  if (lc.includes('energy minister') || lc.includes('minister')) {
    keywords.push('energy secretary', 'oil minister', 'petroleum minister');
  }
  
  // Statement/announcement variations
  if (lc.includes('statement') || lc.includes('announcement')) {
    keywords.push('press release', 'declaration', 'remarks', 'comments');
  }
  
  // JWC/Lloyd's variations
  if (lc.includes('jwc') || lc.includes('lloyd')) {
    keywords.push('joint war committee', 'lloyds', "lloyd's", 'war risk bulletin', 
                  'jwla', 'insurance update');
  }
  
  return [...new Set(keywords)]; // deduplicate
}

// GodsEye Loop Detection Engine v1.0
// Classifies signals by behavior (oscillating/trending/static)
// Identifies active/jammed/stalled feedback loops at 5 frequencies

// ═══════════════════════════════════════════════════════════════
// LOOP FREQUENCY BANDS
// ═══════════════════════════════════════════════════════════════

const LOOP_BANDS = {
  ultrafast: {
    label: "Ultra-Fast",
    cycle: "<6h",
    description: "Intraday market reaction, tactical military, automated systems",
    signals: ["S7","S25","S40","S41","S99","S100"]
  },
  fast: {
    label: "Fast",
    cycle: "6h-2d",
    description: "TACO cycle, news cycle, tactical political response",
    signals: ["S1","S5","S10","S15","S27","S28","S83","S112"]
  },
  medium: {
    label: "Medium",
    cycle: "2-14d",
    description: "Strategic policy, economic response, military repositioning",
    signals: ["S12","S20","S80a","S82","S95","IL5","L2","G7"]
  },
  slow: {
    label: "Slow",
    cycle: "14-90d",
    description: "Strategic repositioning, infrastructure, alliance shifts",
    signals: ["S35","S42","S110","S111","HU1","HU2","HU3","HU4","HU5","EU1","EU2","EU3","EU4","TW5","AB1"]
  },
  structural: {
    label: "Structural",
    cycle: ">90d",
    description: "Institutional change, technological shifts, generational adaptation",
    signals: ["S114","EU2","EU3","EU4","IL4","VE1"]
  }
};

// ═══════════════════════════════════════════════════════════════
// SIGNAL BEHAVIOR CLASSIFIER
// ═══════════════════════════════════════════════════════════════

function classifySignalBehavior(history, currentValue) {
  // history: [{d:'2026-02-28', v:40}, {d:'2026-03-02', v:60}, ...]
  // Returns: {state: 'OSCILLATING'|'TRENDING'|'STATIC', variance:..., slope:..., amplitude:...}
  
  if (!history || history.length < 3) {
    return {state: 'UNKNOWN', variance: 0, slope: 0, amplitude: 0};
  }

  const values = history.map(h => h.v);
  const n = values.length;
  
  // Calculate variance
  const mean = values.reduce((a,b) => a+b, 0) / n;
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  
  // Calculate trend (linear regression slope)
  const indices = values.map((_, i) => i);
  const meanX = indices.reduce((a,b) => a+b, 0) / n;
  const numerator = indices.reduce((sum, x, i) => sum + (x - meanX) * (values[i] - mean), 0);
  const denominator = indices.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0);
  const slope = denominator !== 0 ? numerator / denominator : 0;
  
  // Calculate amplitude (peak-to-peak over window)
  const max = Math.max(...values);
  const min = Math.min(...values);
  const amplitude = max - min;
  const amplitudePct = mean !== 0 ? (amplitude / mean) * 100 : 0;
  
  // Classification logic
  const variancePct = mean !== 0 ? (stdDev / mean) * 100 : 0;
  const trendPct = n > 1 ? Math.abs(slope) * (n-1) : 0; // Total change over window
  
  let state;
  if (variancePct < 5 && trendPct < 10) {
    state = 'STATIC'; // Low variance, no trend = stuck
  } else if (trendPct > 15 && variancePct < 20) {
    state = 'TRENDING'; // Strong directional movement, low noise
  } else if (variancePct >= 10) {
    state = 'OSCILLATING'; // High variance = feedback loop active
  } else {
    state = 'STATIC'; // Default to static
  }
  
  return {
    state: state,
    variance: variance,
    variancePct: variancePct,
    slope: slope,
    trendPct: trendPct,
    amplitude: amplitude,
    amplitudePct: amplitudePct,
    mean: mean,
    current: currentValue
  };
}

// ═══════════════════════════════════════════════════════════════
// LOOP PHASE CALCULATOR
// ═══════════════════════════════════════════════════════════════

function calculateLoopPhase(bandSignals, signalData, signalHistory) {
  // bandSignals: ['S1','S5',...] from LOOP_BANDS
  // signalData: FR array with current values
  // signalHistory: signals.json signal_history object
  // Returns: {status:'ACTIVE'|'JAMMED'|'STALLED'|'TRANSITIONING', ...}
  
  const behaviors = [];
  
  for (const sigId of bandSignals) {
    const sig = signalData.find(s => s.i === sigId);
    if (!sig) continue;
    
    const history = signalHistory[sigId];
    if (!history || history.length < 3) continue;
    
    const behavior = classifySignalBehavior(history, sig.v);
    behaviors.push({
      id: sigId,
      name: sig.n,
      value: sig.v,
      ...behavior
    });
  }
  
  if (behaviors.length === 0) {
    return {status: 'UNKNOWN', signals: [], counts: {}, avgVariance: 0};
  }
  
  // Count states
  const counts = {
    OSCILLATING: behaviors.filter(b => b.state === 'OSCILLATING').length,
    TRENDING: behaviors.filter(b => b.state === 'TRENDING').length,
    STATIC: behaviors.filter(b => b.state === 'STATIC').length,
    UNKNOWN: behaviors.filter(b => b.state === 'UNKNOWN').length
  };
  
  const total = behaviors.length;
  const pctOsc = (counts.OSCILLATING / total) * 100;
  const pctTrend = (counts.TRENDING / total) * 100;
  const pctStatic = (counts.STATIC / total) * 100;
  
  // Classify loop status
  let status;
  if (pctOsc >= 60) {
    status = 'ACTIVE'; // >60% oscillating = feedback loop running
  } else if (pctTrend >= 60) {
    status = 'TRANSITIONING'; // >60% trending = loop closing/opening
  } else if (pctStatic >= 60) {
    status = 'JAMMED'; // >60% static = loop blocked
  } else {
    status = 'STALLED'; // Mixed state, no clear dominant behavior
  }
  
  // Calculate aggregate metrics
  const avgVariance = behaviors.reduce((sum, b) => sum + b.variancePct, 0) / behaviors.length;
  const avgSlope = behaviors.reduce((sum, b) => sum + Math.abs(b.slope), 0) / behaviors.length;
  const avgAmplitude = behaviors.reduce((sum, b) => sum + b.amplitudePct, 0) / behaviors.length;
  
  return {
    status: status,
    signals: behaviors,
    counts: counts,
    percentages: {
      oscillating: pctOsc,
      trending: pctTrend,
      static: pctStatic
    },
    avgVariance: avgVariance,
    avgSlope: avgSlope,
    avgAmplitude: avgAmplitude,
    total: total
  };
}

// ═══════════════════════════════════════════════════════════════
// RESONANCE DETECTOR
// ═══════════════════════════════════════════════════════════════

function detectResonance(loopPhases) {
  // loopPhases: {ultrafast: {...}, fast: {...}, medium: {...}, ...}
  // Returns: {type:'CONSTRUCTIVE'|'DESTRUCTIVE'|'NEUTRAL', warning:..., details:...}
  
  const active = Object.keys(loopPhases).filter(k => loopPhases[k].status === 'ACTIVE');
  const jammed = Object.keys(loopPhases).filter(k => loopPhases[k].status === 'JAMMED');
  const trending = Object.keys(loopPhases).filter(k => loopPhases[k].status === 'TRANSITIONING');
  
  // CONSTRUCTIVE INTERFERENCE: Multiple loops active and synchronized
  if (active.length >= 3) {
    // Check if slopes are aligned (all trending same direction)
    const slopes = active.map(k => loopPhases[k].avgSlope);
    const allPositive = slopes.every(s => s > 0);
    const allNegative = slopes.every(s => s < 0);
    
    if (allPositive || allNegative) {
      return {
        type: 'CONSTRUCTIVE',
        warning: 'CRISIS ACCELERATION',
        details: `${active.length} loops synchronized and amplifying. ${allPositive ? 'Escalation' : 'De-escalation'} accelerating.`,
        activeLoops: active
      };
    }
  }
  
  // DESTRUCTIVE INTERFERENCE: Fast oscillating, medium jammed
  if (loopPhases.ultrafast && loopPhases.ultrafast.status === 'ACTIVE' &&
      loopPhases.medium && loopPhases.medium.status === 'JAMMED') {
    return {
      type: 'DESTRUCTIVE',
      warning: 'RESONANT DEADLOCK',
      details: 'Ultra-fast loop oscillating around jammed medium loop. High-frequency noise preventing directional movement. Veto gate continuously re-tested.',
      jammedLoop: 'medium',
      oscillatingLoop: 'ultrafast'
    };
  }
  
  // DAMPING: Slow loop active, fast loop stalled
  if (loopPhases.slow && loopPhases.slow.status === 'ACTIVE' &&
      loopPhases.fast && loopPhases.fast.status === 'STALLED') {
    return {
      type: 'DAMPING',
      warning: 'STRATEGIC OVERRIDE',
      details: 'Slow loop (strategic repositioning) dampening fast loop (tactical cycles). Exit likely via slow-loop closure, not tactical breakthrough.',
      dampedLoop: 'fast',
      dominantLoop: 'slow'
    };
  }
  
  // FROZEN: Multiple loops jammed/stalled
  if (jammed.length + active.filter(k => loopPhases[k].status === 'STALLED').length >= 3) {
    return {
      type: 'FROZEN',
      warning: 'SYSTEM FROZEN',
      details: `${jammed.length + active.filter(k => loopPhases[k].status === 'STALLED').length} loops jammed or stalled. Multiple feedback pathways blocked.`,
      frozenLoops: jammed.concat(active.filter(k => loopPhases[k].status === 'STALLED'))
    };
  }
  
  return {
    type: 'NEUTRAL',
    warning: null,
    details: 'No significant resonance or interference detected.'
  };
}

// ═══════════════════════════════════════════════════════════════
// LOOP COHERENCE SCORE
// ═══════════════════════════════════════════════════════════════

function calculateLoopCoherence(loopPhases) {
  // Aggregate metric: how directional is the system?
  // High score (>0.7) = trending, crisis resolving/escalating
  // Low score (<0.3) = chaotic, deadlocked
  
  const allBehaviors = [];
  Object.values(loopPhases).forEach(phase => {
    if (phase.signals) {
      allBehaviors.push(...phase.signals);
    }
  });
  
  if (allBehaviors.length === 0) return 0;
  
  const trending = allBehaviors.filter(b => b.state === 'TRENDING').length;
  const oscillating = allBehaviors.filter(b => b.state === 'OSCILLATING').length;
  const static_ = allBehaviors.filter(b => b.state === 'STATIC').length;
  
  const total = allBehaviors.length;
  const coherence = trending / (oscillating + static_ + 0.01); // Avoid div by zero
  
  return Math.min(1.0, coherence); // Cap at 1.0
}

// ═══════════════════════════════════════════════════════════════
// MAIN ANALYSIS FUNCTION
// ═══════════════════════════════════════════════════════════════

function analyzeLoops(FR, signalHistory) {
  // FR: current signal array from dashboard
  // signalHistory: signals.json signal_history object
  // Returns: complete loop analysis
  
  const loopPhases = {};
  
  for (const [bandKey, band] of Object.entries(LOOP_BANDS)) {
    loopPhases[bandKey] = calculateLoopPhase(band.signals, FR, signalHistory);
    loopPhases[bandKey].label = band.label;
    loopPhases[bandKey].cycle = band.cycle;
    loopPhases[bandKey].description = band.description;
  }
  
  const resonance = detectResonance(loopPhases);
  const coherence = calculateLoopCoherence(loopPhases);
  
  // Determine predicted exit pathway
  let exitPathway = 'UNKNOWN';
  let exitTimeline = 'Unable to determine';
  
  if (loopPhases.medium && loopPhases.medium.status === 'JAMMED' &&
      loopPhases.slow && loopPhases.slow.status === 'ACTIVE') {
    exitPathway = 'SLOW_LOOP';
    exitTimeline = '60-120 days via strategic repositioning (China mediation or food humanitarian exception)';
  } else if (loopPhases.medium && loopPhases.medium.status === 'TRANSITIONING') {
    exitPathway = 'MEDIUM_LOOP';
    exitTimeline = '14-30 days via policy shift (sanctions relief or ceasefire breakthrough)';
  } else if (loopPhases.fast && loopPhases.fast.status === 'ACTIVE') {
    exitPathway = 'FAST_LOOP';
    exitTimeline = '3-10 days via tactical event (TACO pivot or military escalation/de-escalation)';
  }
  
  return {
    loopPhases: loopPhases,
    resonance: resonance,
    coherence: Math.round(coherence * 100),
    exitPathway: exitPathway,
    exitTimeline: exitTimeline,
    timestamp: new Date().toISOString()
  };
}

// Export for use in main dashboard
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LOOP_BANDS,
    classifySignalBehavior,
    calculateLoopPhase,
    detectResonance,
    calculateLoopCoherence,
    analyzeLoops
  };
}

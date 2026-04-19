// Test loop detection engine
const fs = require('fs');
const loopDetector = require('./loop-detector.js');

// Load signals
const signals = JSON.parse(fs.readFileSync('signals.json', 'utf8'));
const FR = signals.FR;
const signalHistory = signals.signal_history;

console.log('Testing Loop Detection Engine\n');
console.log('═══════════════════════════════════════\n');

// Run analysis
const analysis = loopDetector.analyzeLoops(FR, signalHistory);

console.log('LOOP STATUS:\n');
for (const [key, phase] of Object.entries(analysis.loopPhases)) {
  console.log(`${phase.label} (${phase.cycle}):`);
  console.log(`  Status: ${phase.status}`);
  console.log(`  Signals tracked: ${phase.total}`);
  console.log(`  Oscillating: ${phase.counts.OSCILLATING} (${phase.percentages.oscillating.toFixed(1)}%)`);
  console.log(`  Trending: ${phase.counts.TRENDING} (${phase.percentages.trending.toFixed(1)}%)`);
  console.log(`  Static: ${phase.counts.STATIC} (${phase.percentages.static.toFixed(1)}%)`);
  console.log(`  Avg variance: ${phase.avgVariance.toFixed(1)}%\n`);
}

console.log('RESONANCE ANALYSIS:\n');
console.log(`  Type: ${analysis.resonance.type}`);
if (analysis.resonance.warning) {
  console.log(`  Warning: ${analysis.resonance.warning}`);
}
console.log(`  Details: ${analysis.resonance.details}\n`);

console.log('SYSTEM COHERENCE:\n');
console.log(`  Score: ${analysis.coherence}/100`);
console.log(`  Interpretation: ${analysis.coherence > 70 ? 'Directional (trending)' : analysis.coherence > 30 ? 'Mixed (oscillating)' : 'Chaotic (deadlocked)'}\n`);

console.log('EXIT PREDICTION:\n');
console.log(`  Pathway: ${analysis.exitPathway}`);
console.log(`  Timeline: ${analysis.exitTimeline}\n`);

// Sample detailed signal behaviors
console.log('SAMPLE SIGNAL BEHAVIORS:\n');
const ultrafastPhase = analysis.loopPhases.ultrafast;
if (ultrafastPhase.signals.length > 0) {
  console.log('Ultra-fast loop signals:');
  ultrafastPhase.signals.slice(0, 3).forEach(sig => {
    console.log(`  ${sig.id} (${sig.name}): ${sig.state}, value=${sig.value}, variance=${sig.variancePct.toFixed(1)}%`);
  });
}

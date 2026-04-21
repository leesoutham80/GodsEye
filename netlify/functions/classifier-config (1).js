/**
 * GodsEye Signal Classifier Configuration
 * Defines how news headlines/content map to signal value changes
 */

const SIGNAL_CLASSIFIER_CONFIG = {
  
  // ========================================
  // A-CLUSTER: MILITARY (15 signals)
  // ========================================
  
  "S1": {
    // Already live - calculated from kinetic event detection
    auto_calculated: true
  },
  
  "S1b": {
    name: "Theatre Utilization",
    keywords: ["carrier", "strike group", "destroyer", "fifth fleet", "centcom", "naval deployment", "warship", "frigate", "amphibious"],
    up_triggers: ["deployed", "positioned", "arrive", "reinforcement", "additional forces"],
    down_triggers: ["withdraw", "depart", "return to port", "stand down"],
    magnitude_rules: {
      major_deployment: 15,  // Carrier group
      standard: 10,          // Single ship
      minor: 5               // Routine movement
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S1c": {
    name: "Global Force Posture",
    keywords: ["nato", "global deployment", "european command", "pacific fleet", "indo-pacific", "atlantic", "carrier strike group"],
    up_triggers: ["redeploy", "surge", "increase readiness", "mobilize"],
    down_triggers: ["reduce presence", "drawdown", "return home"],
    magnitude_rules: {
      multi_theatre: 20,
      single_theatre: 10,
      minor: 5
    },
    auto_apply: false, // Requires strategic assessment
    confidence_threshold: 0.8
  },
  
  "S1d": {
    name: "Escalation Tier",
    keywords: ["escalation", "strike", "retaliation", "response", "attack", "target"],
    up_triggers: ["nuclear", "strategic", "civilian infrastructure", "capital", "major escalation"],
    down_triggers: ["deescalate", "restraint", "limited response", "proportional"],
    magnitude_rules: {
      nuclear_threat: 30,
      infrastructure: 20,
      military_only: 10,
      ceasefire: -20
    },
    auto_apply: false, // Too sensitive
    confidence_threshold: 0.9
  },
  
  "S1e": {
    name: "Civilian Targeting Index",
    keywords: ["civilian", "casualties", "non-combatant", "residential", "hospital", "school", "bridge"],
    up_triggers: ["civilian casualties", "non-military target", "infrastructure", "deaths", "wounded civilians"],
    down_triggers: ["precision strike", "military target only", "no civilian casualties"],
    magnitude_rules: {
      mass_casualty: 20,
      infrastructure: 15,
      isolated: 10
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S2": {
    name: "Air Superiority Contest",
    keywords: ["aircraft", "fighter", "air defense", "shoot down", "sortie", "air strike", "f-15", "f-16", "mig", "su-"],
    up_triggers: ["shoot down", "aircraft lost", "contested airspace", "SAM active"],
    down_triggers: ["air superiority", "unopposed", "no resistance"],
    magnitude_rules: {
      aircraft_loss: 15,
      engagement: 10,
      sortie_increase: 5
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S3": {
    name: "Physical Closure - Transit Count",
    keywords: ["vessel", "ship", "transit", "strait", "hormuz", "passage", "cargo", "tanker"],
    up_triggers: ["resumed", "transiting", "convoy", "escorted passage"],
    down_triggers: ["blocked", "prevented", "denied passage", "turned back", "closure"],
    magnitude_rules: {
      full_closure: -30,
      partial: -15,
      single_transit: 5,
      convoy: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8,
    note: "Will be overridden by live AIS data when available"
  },
  
  "S4": {
    name: "Mine Warfare Active",
    keywords: ["mine", "explosive", "naval mine", "minelayer", "minesweeper", "mcm", "explosive device"],
    up_triggers: ["mine detected", "mine laid", "minefield", "explosive device found"],
    down_triggers: ["mine cleared", "swept", "safe passage", "no mines"],
    magnitude_rules: {
      minefield: 25,
      single_mine: 15,
      cleared: -15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S5": {
    name: "Kinetic Maritime",
    keywords: ["boarding", "seizure", "confiscate", "detained", "captured", "interdiction"],
    up_triggers: ["vessel seized", "cargo confiscated", "crew detained", "boarded"],
    down_triggers: ["released", "freed", "returned"],
    magnitude_rules: {
      seizure: 20,
      boarding: 10,
      release: -15
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S23": {
    name: "Naval Escort Formation",
    keywords: ["escort", "convoy", "protection", "naval escort", "warship escort"],
    up_triggers: ["escort convoy", "military protection", "naval escort established"],
    down_triggers: ["unescorted", "no protection", "independent transit"],
    magnitude_rules: {
      formal_convoy: 20,
      ad_hoc_escort: 10,
      single_vessel: 5
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S27": {
    name: "Military Concealment",
    keywords: ["classified", "undisclosed", "covert", "secret operation", "opsec", "information blackout"],
    up_triggers: ["classified", "no comment", "operational security", "details withheld"],
    down_triggers: ["disclosed", "confirmed", "transparent", "public statement"],
    magnitude_rules: {
      total_blackout: 20,
      selective: 10,
      transparent: -10
    },
    auto_apply: false, // Absence of info is tricky
    confidence_threshold: 0.6
  },
  
  "S35": {
    name: "Infrastructure Targeting",
    keywords: ["infrastructure", "power plant", "refinery", "port", "bridge", "dam", "energy facility"],
    up_triggers: ["struck", "damaged", "destroyed", "targeted", "hit"],
    down_triggers: ["repaired", "restored", "operational"],
    magnitude_rules: {
      critical_infra: 20,
      secondary: 15,
      tertiary: 10
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S75": {
    name: "Naval Exercise Cancellation",
    keywords: ["naval exercise", "military drill", "training", "exercise cancelled", "postponed"],
    up_triggers: ["cancelled", "postponed", "suspended", "delayed"],
    down_triggers: ["scheduled", "proceeding", "conducted as planned"],
    magnitude_rules: {
      major_exercise: 15,
      routine: 10
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S78": {
    name: "Maritime Cyber Threat",
    keywords: ["cyber", "gps", "ais spoofing", "navigation", "jamming", "interference"],
    up_triggers: ["cyber attack", "gps interference", "spoofing detected", "jamming"],
    down_triggers: ["restored", "normal operations", "no interference"],
    magnitude_rules: {
      widespread: 20,
      targeted: 15,
      isolated: 10
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S83": {
    name: "IRGC Degradation",
    keywords: ["irgc", "revolutionary guard", "casualties", "killed", "destroyed equipment", "losses"],
    up_triggers: ["casualties", "killed", "destroyed", "damaged", "losses"],
    down_triggers: ["reinforced", "replenished", "recovered"],
    magnitude_rules: {
      major_losses: 15,
      moderate: 10,
      minor: 5
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  // ========================================
  // B-CLUSTER: SHIPPING/DIPLOMATIC (6 signals)
  // ========================================
  
  "S14": {
    name: "Anchorage Congestion",
    keywords: ["anchorage", "waiting", "queue", "congestion", "fujairah", "singapore", "backlog"],
    up_triggers: ["congestion", "backlog", "waiting", "queue length"],
    down_triggers: ["cleared", "flowing", "normal operations"],
    magnitude_rules: {
      severe: 20,
      moderate: 15,
      minor: 10
    },
    auto_apply: true,
    confidence_threshold: 0.7,
    note: "Will be overridden by live AIS data"
  },
  
  "S15": {
    name: "Convoy Normalization",
    keywords: ["convoy", "commercial shipping", "resumed", "transit", "normal operations"],
    up_triggers: ["resumed", "normalized", "regular transit", "commercial vessels"],
    down_triggers: ["suspended", "halted", "no transits"],
    magnitude_rules: {
      full_normalization: 25,
      partial: 15,
      single_convoy: 10
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S24": {
    name: "SPR Release Impact",
    keywords: ["strategic petroleum reserve", "spr", "oil release", "emergency release"],
    up_triggers: ["spr release", "strategic reserve tap", "emergency oil"],
    down_triggers: ["spr refill", "reserve replenish"],
    magnitude_rules: {
      major_release: 20,
      moderate: 15,
      announced: 10
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S115": {
    name: "Global Storage Utilization",
    keywords: ["oil storage", "tank tops", "capacity", "cushing", "inventory"],
    up_triggers: ["storage full", "tank tops", "capacity limit"],
    down_triggers: ["storage declining", "inventory draw", "capacity available"],
    magnitude_rules: {
      critical: 20,
      high: 15,
      moderate: 10
    },
    auto_apply: false, // Requires data
    confidence_threshold: 0.7
  },
  
  "S116": {
    name: "Persian Gulf Flaring",
    keywords: ["flaring", "gas flare", "production cut", "shut in"],
    up_triggers: ["flaring increased", "shut in", "production halted"],
    down_triggers: ["production resumed", "flaring reduced"],
    magnitude_rules: {
      major: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  // ========================================
  // C-CLUSTER: MARKET/ECONOMIC (19 signals)
  // ========================================
  
  "S6": {
    name: "Insurance Extension Crisis",
    keywords: ["insurance", "war risk", "lloyd's", "jwc", "jwla", "coverage"],
    up_triggers: ["insurance withdrawn", "coverage suspended", "war risk area", "jwla"],
    down_triggers: ["insurance restored", "coverage available"],
    magnitude_rules: {
      full_withdrawal: 25,
      partial: 15,
      extended_area: 10
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S7": {
    name: "Brent Curve Compression",
    keywords: ["brent", "crude", "backwardation", "contango", "futures curve"],
    up_triggers: ["backwardation", "curve steepens", "tightening"],
    down_triggers: ["contango", "curve flattens", "easing"],
    magnitude_rules: {
      extreme: 20,
      moderate: 15,
      minor: 10
    },
    auto_apply: false, // Will use Yahoo Finance API
    confidence_threshold: 0.7,
    note: "Calculated from live price data"
  },
  
  "S16": {
    name: "Freight Rate Spike",
    keywords: ["freight", "shipping rate", "charter rate", "tanker rate"],
    up_triggers: ["rates surge", "freight spike", "charter costs"],
    down_triggers: ["rates ease", "decline", "normalize"],
    magnitude_rules: {
      extreme: 25,
      high: 15,
      moderate: 10
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S18": {
    name: "VLCC Freight Explosion",
    keywords: ["vlcc", "tanker rate", "td3c", "supertanker"],
    up_triggers: ["rates spike", "charter surge", "worldscale"],
    down_triggers: ["rates decline", "soften"],
    magnitude_rules: {
      extreme: 25,
      high: 15,
      moderate: 10
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S19": {
    name: "Product Crack Spread",
    keywords: ["crack spread", "refining margin", "gasoline", "diesel"],
    up_triggers: ["margins widen", "crack expands"],
    down_triggers: ["margins compress", "crack narrows"],
    magnitude_rules: {
      extreme: 20,
      moderate: 15
    },
    auto_apply: false, // Calculated from prices
    confidence_threshold: 0.7
  },
  
  "S74": {
    name: "Insurance Coverage Withdrawal",
    keywords: ["lloyd's", "insurance market", "war risk", "coverage withdrawn"],
    up_triggers: ["coverage withdrawn", "insurers exit", "jwla declared"],
    down_triggers: ["coverage restored", "insurers return"],
    magnitude_rules: {
      total_withdrawal: 30,
      partial: 20,
      extended_zone: 15
    },
    auto_apply: true,
    confidence_threshold: 0.9
  },
  
  "S76": {
    name: "CPI Divergence",
    keywords: ["inflation", "cpi", "consumer prices", "price index"],
    up_triggers: ["inflation surge", "cpi spike", "prices rise"],
    down_triggers: ["inflation ease", "prices stabilize"],
    magnitude_rules: {
      major: 15,
      moderate: 10
    },
    auto_apply: false, // Official data
    confidence_threshold: 0.8
  },
  
  "S92": {
    name: "Demand Destruction",
    keywords: ["demand destruction", "consumption decline", "rationing"],
    up_triggers: ["demand falls", "consumption down", "rationing"],
    down_triggers: ["demand recovers", "consumption up"],
    magnitude_rules: {
      severe: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S121": {
    name: "Gulf Sovereign CDS",
    keywords: ["credit default swap", "cds", "sovereign risk", "gulf states"],
    up_triggers: ["cds widen", "risk premium", "spreads blow out"],
    down_triggers: ["cds tighten", "spreads narrow"],
    magnitude_rules: {
      extreme: 20,
      moderate: 15
    },
    auto_apply: false, // Requires market data
    confidence_threshold: 0.8
  },
  
  "S122": {
    name: "Brent Options Put/Call Skew",
    keywords: ["options", "put", "call", "skew", "implied volatility"],
    up_triggers: ["put skew", "downside protection", "hedging surge"],
    down_triggers: ["balanced", "call interest"],
    magnitude_rules: {
      extreme: 25,
      high: 15
    },
    auto_apply: false, // Requires options data
    confidence_threshold: 0.7
  },
  
  // ========================================
  // D-CLUSTER: NARRATIVE/DIPLOMATIC (16 signals)
  // ========================================
  
  "S10": {
    name: "Diplomatic Narrative Softening",
    keywords: ["diplomatic", "talks", "negotiation", "dialogue", "mediation"],
    up_triggers: ["talks", "negotiation", "diplomatic channel", "mediation", "dialogue"],
    down_triggers: ["talks collapsed", "no dialogue", "breakdown"],
    magnitude_rules: {
      major_breakthrough: 25,
      progress: 15,
      initial_contact: 10,
      collapse: -20
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S12": {
    name: "Yuan Passage Mechanism",
    keywords: ["yuan", "rmb", "chinese currency", "currency swap", "renminbi"],
    up_triggers: ["yuan settlement", "chinese payment", "rmb", "currency swap"],
    down_triggers: ["dollar only", "yuan rejected"],
    magnitude_rules: {
      formal_mechanism: 20,
      reported_use: 15,
      trial: 10
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S32": {
    name: "AIS Herd Hesitation",
    keywords: ["ais", "vessels waiting", "hesitation", "anchorage"],
    up_triggers: ["vessels waiting", "holding position", "hesitation"],
    down_triggers: ["vessels moving", "transit resumed"],
    magnitude_rules: {
      mass_hesitation: 20,
      partial: 15
    },
    auto_apply: false, // Calculated from AIS
    confidence_threshold: 0.7,
    note: "Will be calculated from live AIS data"
  },
  
  "S33": {
    name: "Media Amplification",
    keywords: ["breaking news", "headlines", "media coverage", "viral"],
    up_triggers: ["breaking", "major coverage", "widespread reporting"],
    down_triggers: ["quiet", "minimal coverage"],
    magnitude_rules: {
      viral: 20,
      major: 15,
      moderate: 10
    },
    auto_apply: true,
    confidence_threshold: 0.6
  },
  
  "S99": {
    name: "Celebrity Amplification",
    keywords: ["celebrity", "influencer", "public figure", "famous"],
    up_triggers: ["celebrity statement", "viral post", "public figure"],
    down_triggers: ["quiet", "no celebrity mention"],
    magnitude_rules: {
      major_figure: 15,
      moderate: 10
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S112": {
    name: "Karbala Paradigm Index",
    keywords: ["martyrdom", "sacrifice", "resistance", "theological", "khamenei", "supreme leader"],
    up_triggers: ["martyrdom", "resistance", "will not surrender", "religious duty"],
    down_triggers: ["pragmatism", "negotiate", "compromise"],
    magnitude_rules: {
      theological_commitment: 20,
      rhetoric: 15,
      moderate: 10
    },
    auto_apply: false, // Requires theological analysis
    confidence_threshold: 0.8
  },
  
  "S113": {
    name: "Temple Mount Status",
    keywords: ["temple mount", "al-aqsa", "jerusalem", "haram al-sharif"],
    up_triggers: ["incident", "clash", "restriction", "closure"],
    down_triggers: ["normal access", "calm", "open"],
    magnitude_rules: {
      major_incident: 20,
      minor: 10
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S114": {
    name: "Time Horizon Divergence",
    keywords: ["long-term", "generational", "patience", "timeline"],
    up_triggers: ["decades", "generational", "long game", "patience"],
    down_triggers: ["immediate", "urgent", "short-term"],
    magnitude_rules: {
      explicit_long_term: 15,
      implied: 10
    },
    auto_apply: false, // Nuanced assessment
    confidence_threshold: 0.7
  },
  
  // ========================================
  // E-CLUSTER: INFRASTRUCTURE/FOOD (10 signals)
  // ========================================
  
  "S80a": {
    name: "Perishable Food Stress",
    keywords: ["food shortage", "supplies", "rations", "hunger", "starvation"],
    up_triggers: ["food shortage", "rations", "supply disruption", "hunger"],
    down_triggers: ["supplies restored", "aid delivered"],
    magnitude_rules: {
      critical: 25,
      severe: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S82": {
    name: "Desalination Risk",
    keywords: ["desalination", "water plant", "freshwater", "desal"],
    up_triggers: ["plant damaged", "water shortage", "desal offline"],
    down_triggers: ["plant operational", "water restored"],
    magnitude_rules: {
      plant_offline: 25,
      damage: 20,
      risk: 15
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S84": {
    name: "Fishing Ground Denial",
    auto_calculated: true,
    note: "Live via GFW API"
  },
  
  "S110": {
    name: "Helium Supply Disruption",
    keywords: ["helium", "industrial gas", "ras laffan", "qatar helium"],
    up_triggers: ["helium shortage", "supply disruption", "plant offline"],
    down_triggers: ["supply restored", "plant operational"],
    magnitude_rules: {
      major_disruption: 20,
      partial: 15,
      risk: 10
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S111": {
    name: "Fertiliser/Ammonia Supply",
    keywords: ["fertiliser", "ammonia", "urea", "agriculture"],
    up_triggers: ["shortage", "supply cut", "plant offline"],
    down_triggers: ["restored", "production resumed"],
    magnitude_rules: {
      critical: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S77": {
    name: "Climate Port Stress",
    keywords: ["port", "climate", "weather", "storm", "flooding"],
    up_triggers: ["port closure", "weather damage", "flooding"],
    down_triggers: ["port reopened", "weather cleared"],
    magnitude_rules: {
      closure: 20,
      disruption: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  // ========================================
  // F/G-CLUSTER: SCENARIOS/PORTFOLIO (8 signals)
  // ========================================
  
  "S80b": {
    name: "Medical Supply Chain",
    keywords: ["medical", "pharmaceutical", "medicine", "hospital supplies"],
    up_triggers: ["shortage", "supply cut", "disruption"],
    down_triggers: ["restored", "supplies delivered"],
    magnitude_rules: {
      critical: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S91": {
    name: "Nuclear Material Seizure",
    keywords: ["nuclear", "enrichment", "uranium", "bushehr", "natanz"],
    up_triggers: ["seized", "secured", "taken", "captured"],
    down_triggers: ["released", "returned"],
    magnitude_rules: {
      material_seized: 30,
      facility_secured: 25,
      threat: 20
    },
    auto_apply: false, // Extremely sensitive
    confidence_threshold: 0.95
  },
  
  // ========================================
  // SHADOW LAYER: S101-S108 (8 signals)
  // ========================================
  
  "S101": {
    name: "Dark Fleet Activity",
    keywords: ["dark fleet", "shadow tanker", "untracked vessel", "ais off"],
    up_triggers: ["dark fleet", "shadow vessel", "ais disabled"],
    down_triggers: ["tracked", "ais restored", "normal operations"],
    magnitude_rules: {
      major_activity: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S102": {
    name: "Yuan Settlement Volume",
    keywords: ["yuan settlement", "rmb payment", "chinese currency"],
    up_triggers: ["yuan settlement", "rmb transaction", "currency swap"],
    down_triggers: ["dollar settlement", "conventional payment"],
    magnitude_rules: {
      major_volume: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S103": {
    name: "Proxy Resupply",
    keywords: ["weapons", "arms", "resupply", "ammunition"],
    up_triggers: ["weapons delivery", "arms shipment", "resupply"],
    down_triggers: ["embargo", "interdicted"],
    magnitude_rules: {
      major_shipment: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S104": {
    name: "Shadow Fleet Throughput",
    keywords: ["throughput", "shadow fleet", "dark vessel"],
    up_triggers: ["increased", "surge", "expanded"],
    down_triggers: ["decreased", "reduced"],
    magnitude_rules: {
      major: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S105": {
    name: "Dubai Financial Node Stress",
    keywords: ["dubai", "uae", "financial hub", "banking"],
    up_triggers: ["sanctions", "pressure", "restrictions", "compliance"],
    down_triggers: ["normal operations", "sanctions eased"],
    magnitude_rules: {
      sanctions: 25,
      pressure: 20,
      risk: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S106": {
    name: "China Dual Posture",
    keywords: ["china", "beijing", "xi jinping", "dual track"],
    up_triggers: ["public support iran", "private pressure", "dual position"],
    down_triggers: ["single position", "clear stance"],
    magnitude_rules: {
      explicit_dual: 20,
      implied: 15
    },
    auto_apply: false, // Requires analysis
    confidence_threshold: 0.75
  },
  
  "S107": {
    name: "Shadow-Legitimate Divergence",
    keywords: ["divergence", "shadow", "legitimate", "two-tier"],
    up_triggers: ["price divergence", "two-tier market", "shadow discount"],
    down_triggers: ["price convergence", "unified market"],
    magnitude_rules: {
      major_divergence: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S108": {
    name: "Displacement Corridor",
    keywords: ["corridor", "route", "bypass", "alternative"],
    up_triggers: ["new corridor", "alternative route", "bypass established"],
    down_triggers: ["corridor closed", "route blocked"],
    magnitude_rules: {
      new_corridor: 20,
      expansion: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  // ========================================
  // REMAINING A-CLUSTER SIGNALS
  // ========================================
  
  "S8": {
    name: "Sustained Fire Tempo",
    keywords: ["sustained", "continuous", "daily strikes", "ongoing"],
    up_triggers: ["daily strikes", "sustained tempo", "continuous operations"],
    down_triggers: ["pause", "lull", "reduced tempo"],
    magnitude_rules: {
      intense: 20,
      sustained: 15,
      moderate: 10
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S9": {
    name: "Precision vs Area Strike",
    keywords: ["precision", "area strike", "carpet bomb", "targeted"],
    up_triggers: ["area strike", "widespread", "carpet bombing"],
    down_triggers: ["precision", "targeted", "surgical"],
    magnitude_rules: {
      area: 20,
      precision: -10
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S11": {
    name: "Urban Combat Intensity",
    keywords: ["urban", "city", "street fighting", "building"],
    up_triggers: ["urban combat", "city fighting", "street battles"],
    down_triggers: ["withdrawal", "ceased"],
    magnitude_rules: {
      intense: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S13": {
    name: "Air Defense Effectiveness",
    keywords: ["air defense", "sam", "shoot down", "intercept"],
    up_triggers: ["shot down", "intercepted", "effective defense"],
    down_triggers: ["failed intercept", "overwhelmed"],
    magnitude_rules: {
      successful: 15,
      failed: -10
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S17": {
    name: "Attrition Rate",
    keywords: ["casualties", "losses", "attrition", "wounded"],
    up_triggers: ["heavy casualties", "high losses", "mounting toll"],
    down_triggers: ["light casualties", "minimal losses"],
    magnitude_rules: {
      heavy: 20,
      moderate: 15,
      light: 10
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S20": {
    name: "Options Market Put Skew",
    keywords: ["options", "put", "call", "volatility"],
    up_triggers: ["put buying", "hedging surge", "volatility spike"],
    down_triggers: ["call buying", "volatility decline"],
    magnitude_rules: {
      extreme: 25,
      high: 15
    },
    auto_apply: false, // Requires market data
    confidence_threshold: 0.7
  },
  
  "S21": {
    name: "Cross-Asset Correlation",
    keywords: ["correlation", "gold", "safe haven", "flight to safety"],
    up_triggers: ["gold surge", "safe haven bid", "risk off"],
    down_triggers: ["risk on", "safe haven selling"],
    magnitude_rules: {
      extreme: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S22": {
    name: "Refiners Margin Squeeze",
    keywords: ["refiner", "margin", "crack spread", "processing"],
    up_triggers: ["margins squeezed", "crack compressed", "refiner losses"],
    down_triggers: ["margins expand", "crack widens"],
    magnitude_rules: {
      severe: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S25": {
    name: "Alternate Route Premium",
    keywords: ["cape route", "good hope", "alternative route", "rerouting"],
    up_triggers: ["rerouting", "cape route", "alternative path"],
    down_triggers: ["direct route", "hormuz route"],
    magnitude_rules: {
      major_rerouting: 20,
      partial: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S26": {
    name: "Bunker Fuel Premium",
    keywords: ["bunker", "fuel oil", "marine fuel"],
    up_triggers: ["bunker surge", "fuel premium", "supply tight"],
    down_triggers: ["bunker eases", "supply adequate"],
    magnitude_rules: {
      extreme: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S28": {
    name: "Crew Reluctance Index",
    keywords: ["crew", "seafarer", "manning", "recruitment"],
    up_triggers: ["crew shortage", "reluctant", "hazard pay"],
    down_triggers: ["crew available", "normal manning"],
    magnitude_rules: {
      severe_shortage: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S29": {
    name: "Charter Cancellation Rate",
    keywords: ["charter", "contract", "cancellation", "booking"],
    up_triggers: ["charters cancelled", "bookings withdrawn"],
    down_triggers: ["charters firm", "bookings normal"],
    magnitude_rules: {
      mass_cancellation: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S30": {
    name: "Port Congestion Cascade",
    keywords: ["port", "congestion", "backlog", "queue"],
    up_triggers: ["port congestion", "backlog", "delays"],
    down_triggers: ["congestion eases", "normal flow"],
    magnitude_rules: {
      severe: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S31": {
    name: "Insurance Premium Spike",
    keywords: ["insurance", "premium", "war risk", "coverage cost"],
    up_triggers: ["premium spike", "rates surge", "war risk premium"],
    down_triggers: ["premium decline", "rates normalize"],
    magnitude_rules: {
      extreme: 25,
      high: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S34": {
    name: "Letter of Credit Freeze",
    keywords: ["letter of credit", "lc", "trade finance", "banking"],
    up_triggers: ["lc frozen", "trade finance halted", "banking freeze"],
    down_triggers: ["lc restored", "trade finance normal"],
    magnitude_rules: {
      freeze: 25,
      restrictions: 20
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S36": {
    name: "Refinery Utilization",
    keywords: ["refinery", "utilization", "runs", "throughput"],
    up_triggers: ["utilization down", "runs cut", "maintenance"],
    down_triggers: ["utilization up", "runs increase"],
    magnitude_rules: {
      major_cut: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S37": {
    name: "Pipeline Constraint",
    keywords: ["pipeline", "bottleneck", "capacity", "constraint"],
    up_triggers: ["pipeline full", "bottleneck", "capacity hit"],
    down_triggers: ["capacity available", "flows normal"],
    magnitude_rules: {
      constraint: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S38": {
    name: "Tanker Fleet Utilization",
    keywords: ["tanker fleet", "utilization", "availability"],
    up_triggers: ["fleet tight", "limited availability", "high utilization"],
    down_triggers: ["fleet loose", "tonnage available"],
    magnitude_rules: {
      tight: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S39": {
    name: "OPEC+ Production Response",
    keywords: ["opec", "production", "output", "quota"],
    up_triggers: ["opec increase", "production up", "spare capacity"],
    down_triggers: ["opec cut", "production down"],
    magnitude_rules: {
      major_change: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S40": {
    name: "US Shale Response",
    keywords: ["shale", "permian", "rig count", "drilling"],
    up_triggers: ["rig count up", "drilling increase", "shale response"],
    down_triggers: ["rig count down", "drilling cuts"],
    magnitude_rules: {
      major_ramp: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S79": {
    name: "Transit Composition",
    keywords: ["vessel type", "cargo type", "transit composition"],
    up_triggers: ["military only", "naval dominance"],
    down_triggers: ["commercial mix", "normal composition"],
    magnitude_rules: {
      military_only: 20,
      skewed: 15
    },
    auto_apply: false, // Calculated from AIS
    confidence_threshold: 0.7
  },
  
  "S85": {
    name: "Humanitarian Corridor Status",
    keywords: ["humanitarian", "corridor", "aid", "relief"],
    up_triggers: ["corridor open", "aid delivered", "relief access"],
    down_triggers: ["corridor closed", "aid blocked"],
    magnitude_rules: {
      open: -15,
      closed: 20
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S86": {
    name: "Diaspora Remittance Flow",
    keywords: ["remittance", "diaspora", "money transfer"],
    up_triggers: ["remittances halted", "transfers blocked"],
    down_triggers: ["remittances flowing", "normal transfers"],
    magnitude_rules: {
      halted: 20,
      disrupted: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S87": {
    name: "Tourism Collapse",
    keywords: ["tourism", "travel", "visitors", "hotels"],
    up_triggers: ["tourism collapse", "travel ban", "visitors down"],
    down_triggers: ["tourism recovers", "travel resumes"],
    magnitude_rules: {
      collapse: 25,
      severe: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S88": {
    name: "Aviation Rerouting",
    keywords: ["aviation", "flights", "airspace", "reroute"],
    up_triggers: ["airspace closed", "flights rerouted", "no-fly zone"],
    down_triggers: ["airspace open", "normal routing"],
    magnitude_rules: {
      closure: 25,
      rerouting: 20,
      restrictions: 15
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S89": {
    name: "Satellite Imaging Frequency",
    keywords: ["satellite", "imagery", "surveillance", "monitoring"],
    up_triggers: ["increased imaging", "surveillance surge", "monitoring intensified"],
    down_triggers: ["normal monitoring", "routine imaging"],
    magnitude_rules: {
      surge: 15,
      increase: 10
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S90": {
    name: "SIGINT Activity",
    keywords: ["signals intelligence", "sigint", "intercept", "monitoring"],
    up_triggers: ["sigint surge", "monitoring increased", "interception"],
    down_triggers: ["normal monitoring"],
    magnitude_rules: {
      surge: 20,
      increase: 15
    },
    auto_apply: false, // Classified info
    confidence_threshold: 0.8
  },
  
  "S93": {
    name: "Corporate Force Majeure Claims",
    keywords: ["force majeure", "contract", "liability"],
    up_triggers: ["force majeure declared", "contracts suspended"],
    down_triggers: ["contracts honored", "normal operations"],
    magnitude_rules: {
      widespread: 20,
      isolated: 15
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S94": {
    name: "Reinsurance Market Stress",
    keywords: ["reinsurance", "reinsurer", "lloyd's", "capacity"],
    up_triggers: ["reinsurance withdrawn", "capacity constrained"],
    down_triggers: ["reinsurance available", "capacity adequate"],
    magnitude_rules: {
      withdrawal: 25,
      stress: 20
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S95": {
    name: "Sanctions Escalation",
    keywords: ["sanctions", "restrictions", "embargo", "penalties"],
    up_triggers: ["new sanctions", "sanctions expanded", "embargo"],
    down_triggers: ["sanctions lifted", "restrictions eased"],
    magnitude_rules: {
      major_escalation: 25,
      expansion: 20,
      minor: 15
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S96": {
    name: "Central Bank Swap Lines",
    keywords: ["swap line", "central bank", "liquidity", "currency swap"],
    up_triggers: ["swap line activated", "liquidity support"],
    down_triggers: ["swap line unused", "normal liquidity"],
    magnitude_rules: {
      activation: 20,
      preparation: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S97": {
    name: "Credit Rating Downgrade",
    keywords: ["credit rating", "downgrade", "moody's", "s&p", "fitch"],
    up_triggers: ["downgrade", "rating cut", "outlook negative"],
    down_triggers: ["upgrade", "outlook positive"],
    magnitude_rules: {
      major_downgrade: 20,
      single_notch: 15,
      outlook: 10
    },
    auto_apply: true,
    confidence_threshold: 0.9
  },
  
  "S98": {
    name: "Bond Market Stress",
    keywords: ["bond", "yield", "spread", "treasury"],
    up_triggers: ["yields spike", "spread widens", "bond selloff"],
    down_triggers: ["yields fall", "spread tightens", "bond rally"],
    magnitude_rules: {
      extreme: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S100": {
    name: "Reflexivity Index",
    auto_calculated: true,
    note: "Calculated from D-cluster vs B-cluster + S23-S15 gap"
  },
  
  // ========================================
  // EXPERIMENTAL/DIAGNOSTIC SIGNALS (S41-S73)
  // ========================================
  
  "S41": {
    name: "Cyber Attack Intensity",
    keywords: ["cyber attack", "hack", "ransomware", "ddos"],
    up_triggers: ["cyber attack", "hacked", "systems down"],
    down_triggers: ["systems restored", "attack repelled"],
    magnitude_rules: {
      major: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S42": {
    name: "Propaganda Intensity",
    keywords: ["propaganda", "information war", "psyops"],
    up_triggers: ["propaganda surge", "information campaign"],
    down_triggers: ["propaganda decline"],
    magnitude_rules: {
      intense: 15,
      moderate: 10
    },
    auto_apply: true,
    confidence_threshold: 0.7
  },
  
  "S43": {
    name: "Alliance Fragmentation",
    keywords: ["alliance", "coalition", "disagreement", "fracture"],
    up_triggers: ["disagreement", "fracture", "split"],
    down_triggers: ["unity", "agreement", "cohesion"],
    magnitude_rules: {
      major_split: 20,
      disagreement: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S44": {
    name: "UN Security Council Deadlock",
    keywords: ["un security council", "unsc", "veto", "resolution"],
    up_triggers: ["veto", "blocked", "deadlock"],
    down_triggers: ["resolution passed", "agreement"],
    magnitude_rules: {
      veto: 20,
      deadlock: 15
    },
    auto_apply: true,
    confidence_threshold: 0.85
  },
  
  "S45": {
    name: "ICC Investigation",
    keywords: ["icc", "international criminal court", "war crimes"],
    up_triggers: ["investigation launched", "warrant issued"],
    down_triggers: ["investigation closed"],
    magnitude_rules: {
      warrant: 25,
      investigation: 20
    },
    auto_apply: true,
    confidence_threshold: 0.9
  },
  
  "S46": {
    name: "Refugee Flow",
    keywords: ["refugee", "displaced", "exodus", "migration"],
    up_triggers: ["refugee surge", "mass exodus", "displacement"],
    down_triggers: ["refugees return", "flow slows"],
    magnitude_rules: {
      mass_exodus: 25,
      surge: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S47": {
    name: "NGO Withdrawal",
    keywords: ["ngo", "aid organization", "withdrawal", "evacuate"],
    up_triggers: ["ngo withdraws", "aid suspended", "evacuated"],
    down_triggers: ["ngo returns", "aid resumed"],
    magnitude_rules: {
      mass_withdrawal: 20,
      partial: 15
    },
    auto_apply: true,
    confidence_threshold: 0.8
  },
  
  "S48": {
    name: "Social Media Sentiment",
    keywords: ["social media", "twitter", "viral", "trending"],
    up_triggers: ["viral", "trending", "outrage"],
    down_triggers: ["sentiment improves", "calms"],
    magnitude_rules: {
      viral: 15,
      trending: 10
    },
    auto_apply: true,
    confidence_threshold: 0.6
  },
  
  "S49": {
    name: "Protest Activity",
    keywords: ["protest", "demonstration", "rally", "unrest"],
    up_triggers: ["mass protest", "unrest", "riots"],
    down_triggers: ["protest ends", "calm restored"],
    magnitude_rules: {
      riots: 25,
      mass_protest: 20,
      moderate: 15
    },
    auto_apply: true,
    confidence_threshold: 0.75
  },
  
  "S50": {
    name: "Government Stability",
    keywords: ["government", "regime", "stability", "coup"],
    up_triggers: ["unstable", "coup", "crisis"],
    down_triggers: ["stable", "secure"],
    magnitude_rules: {
      coup: 30,
      crisis: 25,
      instability: 20
    },
    auto_apply: false, // Sensitive
    confidence_threshold: 0.9
  },
  
  // Remaining diagnostic/experimental signals (S51-S73) - mostly auto-calculated or require specific data
  "S51": { auto_calculated: true, note: "Market microstructure - requires tick data" },
  "S52": { auto_calculated: true, note: "Order flow imbalance - requires exchange data" },
  "S53": { auto_calculated: true, note: "Volatility surface - requires options data" },
  "S54": { auto_calculated: true, note: "Liquidity depth - requires order book" },
  "S55": { auto_calculated: true, note: "Cross-market arbitrage - calculated" },
  "S56": { auto_calculated: true, note: "Acoustic monitoring - requires sensors" },
  "S57": { auto_calculated: true, note: "Seismic activity - requires sensors" },
  "S58": { auto_calculated: true, note: "Electromagnetic - requires sensors" },
  "S59": { auto_calculated: true, note: "Ocean pressure - requires sensors" },
  "S60": { auto_calculated: true, note: "Wave turbulence - requires sensors" },
  "S61": { auto_calculated: true, note: "Seismic industrial - requires sensors" },
  "S62": { auto_calculated: true, note: "Explosion detection - requires sensors" },
  "S63": { auto_calculated: true, note: "RF activity - requires sensors" },
  "S64": { auto_calculated: true, note: "GPS interference - requires sensors" },
  "S65": { auto_calculated: true, note: "Mass distribution - requires sensors" },
  "S66": { auto_calculated: true, note: "Diagnostic - calculated from other signals" },
  "S67": { auto_calculated: true, note: "Diagnostic - calculated from other signals" },
  "S68": { auto_calculated: true, note: "Diagnostic - calculated from other signals" },
  "S69": { auto_calculated: true, note: "Diagnostic - calculated from other signals" },
  "S70": { auto_calculated: true, note: "Diagnostic - calculated from other signals" },
  "S71": { auto_calculated: true, note: "Diagnostic - calculated from other signals" },
  "S72": { auto_calculated: true, note: "Diagnostic - calculated from other signals" },
  "S73": { auto_calculated: true, note: "Diagnostic - calculated from other signals" }
};

/**
 * Default rules for signals not explicitly configured above
 */
const DEFAULT_CLASSIFIER_RULES = {
  magnitude: 10,
  auto_apply: false,
  confidence_threshold: 0.75
};

/**
 * Helper: Calculate magnitude from headline sentiment and context
 */
function calculateMagnitude(signal, headline, sentiment, context) {
  const config = SIGNAL_CLASSIFIER_CONFIG[signal];
  if (!config || !config.magnitude_rules) return DEFAULT_CLASSIFIER_RULES.magnitude;
  
  // Check for explicit magnitude keywords
  for (const [key, value] of Object.entries(config.magnitude_rules)) {
    if (headline.toLowerCase().includes(key.replace(/_/g, ' '))) {
      return value;
    }
  }
  
  // Default to standard magnitude
  return config.magnitude_rules.standard || config.magnitude_rules.moderate || 10;
}

/**
 * Helper: Determine direction from headline
 */
function determineDirection(signal, headline) {
  const config = SIGNAL_CLASSIFIER_CONFIG[signal];
  if (!config) return null;
  
  const headlineLower = headline.toLowerCase();
  
  // Check up triggers
  const upMatch = config.up_triggers?.some(trigger => 
    headlineLower.includes(trigger.toLowerCase())
  );
  
  // Check down triggers
  const downMatch = config.down_triggers?.some(trigger => 
    headlineLower.includes(trigger.toLowerCase())
  );
  
  if (upMatch && !downMatch) return 'up';
  if (downMatch && !upMatch) return 'down';
  if (upMatch && downMatch) return 'mixed'; // Ambiguous
  
  return null;
}

// Export as CommonJS
module.exports = {
  SIGNAL_CLASSIFIER_CONFIG,
  DEFAULT_CLASSIFIER_RULES,
  calculateMagnitude,
  determineDirection
};

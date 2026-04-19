// godseye-classifier.js v2.0
// 16 classification tags mapped to signal clusters
// 5 intensity tiers per tag (~500+ keywords)
// Custom watch support — dynamic keyword injection
// Intensity: 1=ambient/rumour, 2=developing, 3=confirmed, 4=major, 5=critical/historic

const CLASSIFIER_FRAMEWORK = {

  // ═══ THEATRE: UKRAINE ═══
  ukraine: {
    signals: ["U1","U2","U3","U4","U5","U6","U7","U8","U9","U10"],
    tier1: ["ukraine","kyiv","kiev","zelensky","kharkiv","odesa","odessa","donbas","crimea","mariupol","lviv"],
    tier2: ["frontline","artillery","HIMARS","ATACMS","Storm Shadow","Patriot","NASAMS","drone strike Russia","Black Sea fleet","Sevastopol","grain corridor","TTF gas","european gas"],
    tier3: ["air defence depletion","ammunition shortage","Western aid","Ramstein","NATO summit","Russian advance","Russian retreat","mobilisation Russia","Wagner","Storm-Z","Orenburg","Gazprom","Nord Stream"],
    tier4: ["nuclear plant Zaporizhzhia","Kerch bridge","major offensive","frontline collapse","capital strike Kyiv","capital strike Moscow","Kremlin attack","NATO direct involvement","Article 4 invoked","Article 5 invoked"],
    tier5: ["nuclear use Ukraine","tactical nuclear","NATO troops Ukraine","Russian collapse","Putin removed","Ukraine surrender","Russia surrender"]
  },

  lebanon: {
    signals: ["L1","L2","L3","L4","L5","L6","L7","L8"],
    tier1: ["lebanon","beirut","hezbollah","litani","blue line","UNIFIL","LAF","south lebanon","nabatieh","tyre","sidon","metula","kiryat shmona"],
    tier2: ["IDF strike lebanon","IDF northern command","Galilee evacuation","Bint Jbeil","Marjayoun","Khiam","Naqoura","Radwan force","precision missile","Hezbollah rocket","cross-border fire","reservist call-up northern","Litani violation","ceasefire violation lebanon"],
    tier3: ["Naim Qassem","Sheikh Qassem","Berri","Nabih Berri","Joseph Aoun","Nawaf Salam","Mikati","cabinet collapse lebanon","presidential vacancy","LAF deployment south","UNIFIL incident","peacekeeper casualty","Beirut port","diaspora remittance","lira collapse","Damascus airport strike","Hezbollah resupply","Syria corridor","Qusayr","Bekaa valley"],
    tier4: ["Hezbollah mobilisation","sustained kinetic exchange","IDF ground incursion lebanon","Beirut southern suburbs strike","Dahieh strike","mass evacuation Galilee","Hezbollah long-range salvo","Haifa strike","Tel Aviv strike from lebanon"],
    tier5: ["full Hezbollah mobilisation","second Lebanon war","IDF Litani crossing","Beirut capital strike","Iran direct involvement lebanon","NATO Lebanon deployment"]
  },





  eu_defence: {
    signals: ["EU1","EU2","EU3","EU4","HU1","HU2","HU3"],
    tier1: ["EU defence","european defence","ReArm Europe","Zeitenwende","NATO spending","EU rearmament"],
    tier2: ["defence spending","Rheinmetall","KNDS","Eurofighter","Leopard","Boxer","ammunition production","EDIP","defence industrial","joint procurement","EU borrowing defence","debt brake","escape clause","fiscal rule","Stability and Growth Pact"],
    tier3: ["Friedrich Merz","defence budget","strategic autonomy","european army","EU rapid deployment","german rearmament","Bundeswehr","OPLAN DEU","Tomahawk germany","Baltic brigade","Lithuania deployment","NATO eastern flank","european pillar","transatlantic trust"],
    tier4: ["EU nuclear umbrella","french nuclear sharing","Finland nuclear hosting","Macron nuclear","european deterrence","NATO without US","post-American NATO","800 billion defence"],
    tier5: ["EU army formed","european nuclear weapon","NATO dissolved","US withdraws Europe","transatlantic alliance collapse"]
  },

  taiwan: {
    signals: ["TW1","TW2","TW3","TW4","TW5","TW6"],
    tier1: ["taiwan","taipei","TSMC","strait","PLA","south china sea","SCS"],
    tier2: ["Taiwan Strait","Chinese military","PLA Navy","carrier group pacific","FONOP","Spratly","Paracel","nine-dash line","AUKUS","Quad","semiconductor","chip export"],
    tier3: ["PLA exercise","ADIZ incursion","median line crossing","Taiwan arms sale","Pelosi Taiwan","blockade drill","amphibious exercise","Dongfeng","DF-21D","carrier killer","TSMC disruption","chip shortage"],
    tier4: ["quarantine taiwan","PLA mobilisation","Taiwan invasion rehearsal","semiconductor embargo","US carrier withdrawn pacific","seventh fleet redeployed"],
    tier5: ["Taiwan invasion","PLA amphibious assault","US-China direct conflict","nuclear threat taiwan","TSMC destroyed"]
  },

  arctic: {
    signals: ["AB1","AB2","AB3","AB4"],
    tier1: ["arctic","GIUK gap","baltic","submarine","Svalbard","Kola","Murmansk"],
    tier2: ["GIUK patrol","P-8 Poseidon","SOSUS","ASW","NATO baltic","Russian submarine","Yasen","Akula","Severodvinsk","Gotland","Baltic fleet","icebreaker"],
    tier3: ["GIUK gap coverage","Atlantic patrol reduced","submarine detection","Arctic Council","Svalbard treaty","Northern Fleet exercise","Baltic pipeline","Nord Stream","Kaliningrad"],
    tier4: ["submarine incursion NATO waters","Arctic military buildup","subsea cable sabotage","Baltic confrontation","GIUK gap breach"],
    tier5: ["Arctic conflict","NATO Article 5 baltic","submarine engagement","nuclear submarine incident"]
  },

  venezuela: {
    signals: ["VE1","VE2","VE3","VE4","S42"],
    tier1: ["venezuela","caracas","maduro","PDVSA","venezuelan"],
    tier2: ["oil recovery venezuela","sanctions relief venezuela","Chevron Venezuela","Cuba Russia","Havana","ALBA","Citgo","Guaido","opposition venezuela"],
    tier3: ["Venezuelan election","migration crisis","Colombian border","PDVSA production","heavy crude","Orinoco belt","sanctions waiver","license renewal"],
    tier4: ["regime change venezuela","US intervention venezuela","Cuban missile crisis repeat","Russian naval base cuba"],
    tier5: ["Venezuela collapse","Cuban revolution","US invasion venezuela"]
  },

  nigeria: {
    signals: ["NA1","NA2","NA3"],
    tier1: ["nigeria","lagos","abuja","AFRICOM","sahel","boko haram"],
    tier2: ["Lakurawa","ISSP","Sokoto","Niger coup","Sahel Province","AFRICOM strike","Christmas strike nigeria","Tinubu"],
    tier3: ["christian genocide claim","ISWAP","Niger border","bandit","kidnapping nigeria","school abduction","military spending nigeria"],
    tier4: ["US troops nigeria","guns blazing","AFRICOM expansion","sahel collapse","west africa instability"],
    tier5: ["Nigeria failed state","ECOWAS collapse","sahel caliphate"]
  },

  hungary: {
    signals: ["HU1","HU2","HU3","HU4","HU5"],
    tier1: ["hungary","budapest","magyar","tisza","orban","fidesz","hungarian"],
    tier2: ["peter magyar","viktor orban","EU veto hungary","NATO hungary","hungarian parliament","two-thirds majority","EU frozen funds","rule of law hungary"],
    tier3: ["magyar government","tisza party","fidesz collapse","hungarian election","EU sanctions vote","Article 7","democratic backsliding reversed","media freedom hungary","corruption overhaul"],
    tier4: ["orban arrested","hungarian constitutional reform","EU readmission","NATO realignment","russian influence purge hungary","16 billion euros released"],
    tier5: ["hungary leaves EU","hungary expelled NATO","russian military hungary","hungarian civil war"]
  },

  gaza: {
    signals: ["G1","G2","G3","G4","G5","G6","G7"],
    tier1: ["gaza","hamas","khan younis","rafah","jabalia","nuseirat","deir al-balah","gaza city","strip"],
    tier2: ["UNRWA","Kerem Abu Salem","Philadelphi corridor","Netzarim corridor","hostage deal","ceasefire deal gaza","aid corridor","humanitarian pause","IDF ground operation gaza","tunnel operation"],
    tier3: ["Sinwar successor","Mohammed Deif","Yahya Sinwar","Ismail Haniyeh successor","hostage video","mass casualty event gaza","famine gaza","ICJ provisional measures","UNRWA defunding","Rafah crossing closed","WHO gaza hospital"],
    tier4: ["genocide finding","ICC arrest warrant Netanyahu","hostage execution","aid worker killed gaza","UNRWA headquarters struck","mass grave discovered","hospital siege","refugee camp strike"],
    tier5: ["total humanitarian collapse gaza","forced displacement Sinai","ethnic cleansing finding","NATO intervention gaza","Egyptian military response"]
  },

  israel: {
    signals: ["IL1","IL2","IL3","IL4","IL5"],
    tier1: ["israel","IDF","Netanyahu","Knesset","Tel Aviv","Jerusalem","Shin Bet","Mossad"],
    tier2: ["Iron Dome","David Sling","Arrow","Ben Gvir","Smotrich","Gallant","Gantz","IDF spokesperson","reservist","conscription","Kirya","shekel","TASE"],
    tier3: ["coalition crisis israel","war cabinet","judicial reform crisis","credit downgrade israel","tech sector israel","multi-front","northern command","southern command","West Bank operation","settler violence"],
    tier4: ["ICC warrant executed","arms embargo israel","diplomatic recall","UN General Assembly israel","ICJ genocide ruling","mass protest Tel Aviv","IDF refusal","pilot refusal"],
    tier5: ["government collapse israel","military coup","nuclear ambiguity breach","Dimona strike","existential threat declaration"]
  },

  // ═══ CLUSTER A: MILITARY/KINETIC ═══
  ceasefire: {
    signals: ["S1","S10","S12","S15"],
    tier1: ["peace talks","diplomatic channels","backchannel","behind the scenes","preliminary discussions","feelers","indirect talks","track two","track 2","informal contacts","quiet diplomacy","unofficial talks","cooling off"],
    tier2: ["negotiations","bilateral talks","mediation effort","peace proposal","diplomatic push","envoy dispatched","shuttle diplomacy","good offices","facilitator","interlocutor","confidence building","de-confliction","hotline","proposals exchanged","framework discussed","olive branch"],
    tier3: ["ceasefire","truce","armistice","cessation of hostilities","pause in fighting","temporary halt","cooling period","de-escalation","stand down","standdown","humanitarian pause","humanitarian corridor","safe passage","suspension of operations","mutual restraint","white flag"],
    tier4: ["ceasefire agreement","peace deal","peace accord","signed agreement","formal truce","cessation agreement","reopening","hormuz reopening","strait reopened","passage restored","détente","rapprochement","breakthrough","historic agreement","landmark deal"],
    tier5: ["permanent ceasefire","peace treaty","war ended","conflict resolved","full normalisation","diplomatic victory","unconditional surrender","capitulation","armistice signed"]
  },
  kinetic: {
    signals: ["S1","S1b","S1c","S1d","S27","S28"],
    tier1: ["military activity","troop movement","mobilisation","deployment","repositioning","flyover","overflight","patrol","show of force","warning shot","flare","illumination round","manoeuvre","exercise","posturing"],
    tier2: ["skirmish","exchange of fire","firefight","engagement","incident","clash","confrontation","hostile fire","small arms fire","mortar","RPG","sniper","IED","roadside bomb","ambush","raid","incursion","probe","recon by fire"],
    tier3: ["strike","airstrike","air strike","missile strike","drone strike","bombing","bombardment","shelling","artillery","rocket attack","cruise missile","ballistic missile","sortie","combat operation","offensive","assault","attack","military operation","interdiction","precision strike","surgical strike","f-15","f-16","f-35","a-10","b-1","b-2","b-52","tomahawk","JDAM","GBU"],
    tier4: ["massive strike","saturation bombing","carpet bombing","barrage","salvo","wave of attacks","blitz","shock and awe","strategic bombing","infrastructure strike","oil facility struck","nuclear facility struck","shoot down","shot down","aircraft downed","ship sunk","destroyed","annihilated","decimated","mass casualty","SAR","rescue operation","pilot captured","POW"],
    tier5: ["nuclear","tactical nuclear","WMD","chemical weapon","biological weapon","radiological","dirty bomb","EMP","strategic weapon","theatre-wide offensive","total war","ground invasion","regime change operation","decapitation strike"]
  },

  // ═══ CLUSTER A: FORCE POSTURE ═══
  force_posture: {
    signals: ["S1b","S1c","S23","S27","S75"],
    tier1: ["carrier group","battle group","naval presence","forward deployed","theatre assets","readiness level","force generation"],
    tier2: ["reinforcement","surge","deployment order","reserve activation","mobilisation order","conscription","draft","additional forces","troop buildup","force posture change","DEFCON","alert level raised"],
    tier3: ["carrier strike group","amphibious ready group","marine expeditionary","special operations","SEAL","SOF","pararescue","combat search and rescue","CSAR","force projection","power projection","theatre command","CENTCOM","EUCOM","INDOPACOM"],
    tier4: ["multiple carrier groups","unprecedented deployment","largest since","historic force level","theatre-wide mobilisation","NATO article 5","mutual defence invoked","coalition formed","joint task force"],
    tier5: ["total mobilisation","wartime footing","martial law","national emergency","all reserves called","civilisation-scale military commitment"]
  },

  // ═══ CLUSTER A: CIVILIAN TARGETING ═══
  civilian_harm: {
    signals: ["S1e","S35","S36","S38"],
    tier1: ["civilian area","residential","populated area","urban","collateral","unintended","regret"],
    tier2: ["civilian casualties","civilian killed","civilian wounded","civilian infrastructure","power station","water plant","bridge struck","road destroyed","dual-use","dual use"],
    tier3: ["hospital struck","school struck","market struck","mosque struck","church struck","refugee camp","shelter","residential building","apartment block","civilian convoy","aid workers killed","journalist killed","deliberate targeting"],
    tier4: ["massacre","atrocity","war crime","crime against humanity","indiscriminate","collective punishment","siege warfare","starvation as weapon","ethnic cleansing","forced displacement","mass grave"],
    tier5: ["genocide","systematic extermination","concentration camp","crimes against humanity tribunal","ICC referral","Nuremberg","universal jurisdiction"]
  },

  // ═══ CLUSTER B: SHIPPING/MARITIME ═══
  shipping: {
    signals: ["S3","S14","S15","S17","S32","S33","S34","S79"],
    tier1: ["maritime advisory","navigation warning","sea conditions","port update","vessel movement","ship traffic","marine notice","coast guard","harbour master","pilot service"],
    tier2: ["shipping disruption","route change","rerouting","diversion","delay","congestion","anchorage","waiting","queuing","bunker","refuelling","berth","draft restriction","backlog","schedule disruption"],
    tier3: ["tanker","supertanker","VLCC","ULCC","Aframax","Suezmax","crude carrier","oil carrier","product tanker","LNG carrier","LPG carrier","chemical tanker","container ship","bulk carrier","freight","vessel","maritime","strait","hormuz","suez","bab-el-mandeb","malacca","cape","panama","convoy","escort","naval escort"],
    tier4: ["tanker attacked","vessel seized","ship impounded","boarding","piracy","mine","limpet mine","torpedo","missile hit ship","tanker on fire","oil spill","cargo lost","vessel sunk","exclusion zone","no-go zone","war zone","AIS dark","AIS off","transponder disabled"],
    tier5: ["strait closed","passage denied","total blockade","all shipping halted","maritime collapse","uninsurable","no commercial transit","permanent closure"]
  },

  // ═══ CLUSTER C: MARKET/FINANCIAL ═══
  market: {
    signals: ["S7","S8","S21","S25","S40"],
    tier1: ["market update","trading session","price move","equity","index","benchmark","valuation","earnings","quarterly","guidance","forecast","outlook","analyst","upgrade","downgrade"],
    tier2: ["oil price","crude","brent","WTI","OPEC","production cut","output","supply","demand","inventory","stockpile","draw","build","refinery","margin","crack spread","contango","backwardation","futures","options","forward curve","ETF","fund flow"],
    tier3: ["price surge","spike","rally","plunge","crash","sell-off","rout","volatility","VIX","fear index","commodity shock","energy crisis","inflation","CPI","rate hike","rate cut","Fed","ECB","central bank","SPR","strategic reserve","release","gold","bitcoin","safe haven","flight to safety"],
    tier4: ["price shock","historic high","record price","all-time high","market panic","circuit breaker","trading halt","flash crash","margin call","forced liquidation","sovereign default","currency collapse","bank run","systemic risk"],
    tier5: ["market meltdown","systemic crisis","financial contagion","global recession","depression","hyperinflation","currency crisis","bretton woods moment","petrodollar collapse","reserve currency shift"]
  },
  insurance: {
    signals: ["S6","S34","S43","S74","S93","S94"],
    tier1: ["insurance","underwriter","premium","policy","cover","risk assessment","actuarial"],
    tier2: ["war risk","war risk premium","JWC","Joint War Committee","hull insurance","cargo insurance","P&I","protection and indemnity","reinsurance","retrocession","syndicate"],
    tier3: ["premium spike","rate increase","cover withdrawn","area excluded","listed area","high risk area","extended area","war risk zone","force majeure clause","cancellation clause","breach of warranty"],
    tier4: ["lloyd's withdrawal","syndicate refuses","uninsurable","cover impossible","blanket exclusion","market hardening","catastrophic loss","total loss","constructive total loss"],
    tier5: ["insurance market collapse","no cover available globally","systemic insurance failure","lloyd's crisis","reinsurance spiral"]
  },

  // ═══ CLUSTER D: NARRATIVE/DIPLOMATIC ═══
  diplomatic: {
    signals: ["S4","S5","S10","S19","S20","S26","S29","S30"],
    tier1: ["statement","press conference","spokesperson","communiqué","readout","phone call","consultation","briefing","comment","tweet","truth social","post"],
    tier2: ["sanction","trade restriction","export control","asset freeze","travel ban","designation","UN vote","security council","resolution","veto","abstention","General Assembly","envoy","ambassador recalled","diplomatic protest"],
    tier3: ["summit","leaders meet","state visit","foreign minister","secretary of state","joint statement","memorandum","framework agreement","roadmap","timeline","conditions","demands","ultimatum","red line","deadline"],
    tier4: ["alliance formed","coalition","joint military","mutual defence","treaty","pact","accord","landmark agreement","normalisation","recognition","embassy opened","relations restored","axis","bloc"],
    tier5: ["new world order","superpower confrontation","NATO article 5","declaration of war","formal state of war","severed relations","total embargo","complete isolation"]
  },

  // ═══ CLUSTER D: INFORMATION WARFARE ═══
  information: {
    signals: ["S88","S99","S100"],
    tier1: ["social media","trending","viral","hashtag","influencer","content creator","commentary","opinion"],
    tier2: ["disinformation","misinformation","propaganda","fake news","deepfake","bot","troll farm","psyop","information operation","narrative warfare","spin","framing"],
    tier3: ["media blackout","internet shutdown","communications cut","OSINT","open source intelligence","satellite imagery","leaked","classified","whistleblower","censorship","press freedom"],
    tier4: ["total information blackout","cyber attack media","hack news agency","state media only","complete censorship","journalist arrested","foreign press expelled"],
    tier5: ["total communications collapse","internet kill switch","civilisation-level information failure"]
  },

  // ═══ CLUSTER E: FOOD/WATER/HUMANITARIAN ═══
  food_water: {
    signals: ["S80a","S80b","S82","S84"],
    tier1: ["food supply","food price","grocery","supermarket","agriculture","harvest","crop","grain","rice","wheat","flour"],
    tier2: ["shortage","scarcity","rationing","queue","price control","panic buying","hoarding","food security","nutrition","malnutrition","hunger","food bank","aid delivery"],
    tier3: ["food crisis","famine warning","famine risk","crop failure","harvest failure","fishing ban","fishing ground","desalination","desal","water shortage","water crisis","freshwater","reservoir","aquifer","contamination","drought"],
    tier4: ["mass displacement","refugee crisis","humanitarian catastrophe","starvation","famine","cholera","disease outbreak","hospital overwhelmed","collapse of services","water contamination","desal plant offline"],
    tier5: ["famine declared","mass starvation","civilisation-level food crisis","complete water failure","regional collapse"]
  },

  // ═══ CLUSTER E: SUPPLY CHAIN ═══
  supply_chain: {
    signals: ["S9","S92","S110","S111"],
    tier1: ["supply chain","logistics","inventory","warehouse","distribution","procurement","sourcing","lead time"],
    tier2: ["delay","backlog","shortage","out of stock","bottleneck","constraint","allocation","just in time","stockpile","strategic reserve"],
    tier3: ["disruption","halt","shutdown","force majeure","plant closure","factory idle","production stop","chip shortage","semiconductor","rare earth","helium","fertiliser","fertilizer","ammonia","urea","potash","phosphate","neon","palladium","lithium","cobalt","nickel","LNG","gas supply"],
    tier4: ["critical shortage","supply collapse","production halt","industry shutdown","export ban","strategic reserve depleted","no substitute available","plant explosion","refinery fire"],
    tier5: ["systemic supply failure","cascading shortage","global supply collapse","civilisation-critical shortage","permanent production loss"]
  },

  // ═══ CLUSTER E: ECOLOGICAL ═══
  ecological: {
    signals: ["S81","S84"],
    tier1: ["environment","wildlife","marine life","ecosystem","biodiversity","conservation","habitat","species"],
    tier2: ["oil spill","chemical spill","pollution","contamination","coral bleaching","fish kill","dead zone","algal bloom","seagrass","mangrove","nesting","breeding","spawning","migration"],
    tier3: ["ecological disaster","environmental catastrophe","mass mortality","species collapse","fishery collapse","reef destruction","breeding failure","spawning failure","turtle nesting","dugong","whale shark","shrimp spawn","hammour","coral death"],
    tier4: ["extinction event","local extinction","population collapse","permanent habitat loss","irreversible damage","ecosystem collapse","dead sea","toxic sea"],
    tier5: ["mass extinction","biosphere collapse","ocean dead zone permanent","civilisation-threatening ecological failure"]
  },

  // ═══ CLUSTER F: NUCLEAR ═══
  nuclear: {
    signals: ["S91","S1d"],
    tier1: ["nuclear","atomic","enrichment","centrifuge","uranium","plutonium","IAEA","nuclear watchdog","inspector","safeguards"],
    tier2: ["nuclear programme","enrichment level","weapons grade","breakout time","fissile material","heavy water","Fordow","Natanz","Isfahan","Bushehr","Arak","yellowcake","UF6"],
    tier3: ["nuclear facility struck","nuclear site","nuclear plant","reactor damage","radiation","radioactive","fallout","contamination zone","meltdown risk","spent fuel","nuclear waste","dirty bomb risk","enrichment facility damaged"],
    tier4: ["nuclear weapon","nuclear test","nuclear detonation","mushroom cloud","tactical nuclear","nuclear strike threatened","nuclear escalation","Dr Strangelove","second strike","first strike","launch on warning"],
    tier5: ["nuclear exchange","nuclear war","mutual assured destruction","MAD","civilisation-ending","nuclear winter","extinction-level"]
  },

  // ═══ CLUSTER G: REGIONAL STABILITY ═══
  regional: {
    signals: ["S85","S86","S89","S90","S97"],
    tier1: ["expat","foreign worker","remittance","diaspora","visa","travel advisory","embassy","consulate"],
    tier2: ["evacuation","departure","repatriation","flight cancellation","border closure","checkpoint","curfew","martial law","protest","demonstration","unrest"],
    tier3: ["mass evacuation","embassy closure","citizen warning","leave immediately","shelter in place","displacement","refugee","IDP","internally displaced","migration surge","brain drain","workforce exodus"],
    tier4: ["regime instability","government collapse","coup attempt","revolution","civil war","partition","secession","failed state","humanitarian corridor needed"],
    tier5: ["regime fallen","state collapse","partition","complete societal breakdown","civilisation-level displacement"]
  },

  // ═══ SHADOW LAYER ═══
  shadow: {
    signals: ["S101","S102","S103","S104","S105","S106","S107"],
    tier1: ["smuggling","black market","informal economy","grey market","parallel import","hawala","underground","illicit","OTC desk","nested transaction","shell company","beneficial owner"],
    tier2: ["sanctions evasion","ship-to-ship transfer","dark fleet","ghost tanker","flag swap","AIS manipulation","false flag","phantom cargo","money laundering","front company","crypto settlement","USDT","tether","tron network","bitcoin payment","yuan passage","yuan mechanism","passage fee","transit toll","passage tax","toll payment","informal toll","protection payment"],
    tier3: ["sanctions busting","iran oil smuggling","dark shipping","sanctioned vessel","designated entity","OFAC","treasury department","asset seizure","cargo seizure","interdiction","chainalysis","blockchain forensics","wallet sanctioned","mixer","tumbler","tornado cash","suez toll","panama slot auction","cape premium","malacca premium","hormuz passage price","chinese escort fee"],
    tier4: ["massive sanctions evasion","shadow fleet","parallel trading system","yuan settlement","alternative SWIFT","CIPS","dedollarisation","cryptocurrency laundering","state-sponsored smuggling","toll war","passage monopoly","chokepoint rent-seeking"],
    tier5: ["complete parallel economy","shadow system dominant","formal system irrelevant","total sanctions failure","parallel financial system operational"]
  },

  // ═══ CONFLICT (general catch-all) ═══
  conflict: {
    signals: ["S2","S26","S83"],
    tier1: ["tensions","rhetoric","sabre-rattling","warning","threat","provocation","brinkmanship","standoff","impasse","belligerent"],
    tier2: ["escalation","military buildup","readiness","reserves called","mobilisation","conscription","proxy","militia","paramilitary","insurgent"],
    tier3: ["IRGC","houthi","hezbollah","pentagon","CENTCOM","IDF","iran","israel","military","war","conflict","combat","theatre","front line","battlefield","campaign","navy","air force","army","marine","submarine","SSN","SSBN","Akula","Yasen","Severodvinsk","Faslane","GIUK gap","Atlantic patrol","SOSUS","P-8 Poseidon","ASW","anti-submarine"],
    tier4: ["major escalation","new front","theatre expansion","proxy war","regional war","multi-front","coalition war","invasion"],
    tier5: ["world war","global conflict","civilisation-level war","nuclear confrontation","existential conflict"]
  },

  // ═══ CYBER ═══
  cyber: {
    signals: ["S78","S87","S64"],
    tier1: ["cyber","hack","breach","vulnerability","patch","update","security advisory"],
    tier2: ["cyber attack","DDoS","ransomware","phishing","malware","data breach","credentials leaked","zero day","exploit","APT","advanced persistent threat"],
    tier3: ["critical infrastructure hack","SCADA","industrial control","port system hack","AIS spoofing","GPS jamming","GPS spoofing","communications disrupted","satellite hack","subsea cable","fibre optic cut"],
    tier4: ["power grid attack","financial system hack","SWIFT attack","nuclear facility cyber","military system compromised","command and control disrupted","stuxnet","wiper malware"],
    tier5: ["systemic cyber collapse","internet down","global communications failure","cyber Pearl Harbor","civilisation-level digital failure"]
  }
};

// Flatten to ordered match list
function buildClassifier(customWatches) {
  const rules = [];
  const tagOrder = ["ukraine","ceasefire","kinetic","civilian_harm","nuclear","force_posture","shipping","insurance","food_water","supply_chain","ecological","shadow","cyber","information","market","diplomatic","regional","conflict"];

  // Custom watches first — highest priority
  if (customWatches && customWatches.length > 0) {
    customWatches.forEach(cw => {
      rules.push({
        tag: cw.tag || "custom",
        words: cw.keywords.map(k => ({ word: k.toLowerCase(), intensity: cw.intensity || 3 })),
        custom: true,
        label: cw.label || "Custom Watch"
      });
    });
  }

  for (const tag of tagOrder) {
    const tiers = CLASSIFIER_FRAMEWORK[tag];
    if (!tiers) continue;
    const words = [];
    for (let t = 5; t >= 1; t--) {
      const key = "tier" + t;
      if (tiers[key]) {
        tiers[key].forEach(w => words.push({ word: w.toLowerCase(), intensity: t }));
      }
    }
    rules.push({ tag, words, signals: tiers.signals || [] });
  }
  return rules;
}

// Classify a headline — returns { tag, intensity, matched_word, signals }
function classifyHeadline(text, customWatches) {
  const lower = text.toLowerCase();
  const rules = buildClassifier(customWatches);
  for (const rule of rules) {
    for (const entry of rule.words) {
      if (lower.includes(entry.word)) {
        return {
          tag: rule.tag,
          intensity: entry.intensity,
          matched: entry.word,
          signals: rule.signals || [],
          custom: rule.custom || false,
          label: rule.label || rule.tag
        };
      }
    }
  }
  return { tag: "conflict", intensity: 1, matched: null, signals: [], custom: false };
}

// Simple tag-only classify (backward compatible)
function classify(text) {
  return classifyHeadline(text).tag;
}

// Get all tags with their signal mappings
function getTagSignalMap() {
  const map = {};
  for (const tag in CLASSIFIER_FRAMEWORK) {
    map[tag] = CLASSIFIER_FRAMEWORK[tag].signals || [];
  }
  return map;
}

// Count keywords per tag
function getFrameworkStats() {
  const stats = {};
  let total = 0;
  for (const tag in CLASSIFIER_FRAMEWORK) {
    let count = 0;
    for (let t = 1; t <= 5; t++) {
      const key = "tier" + t;
      if (CLASSIFIER_FRAMEWORK[tag][key]) count += CLASSIFIER_FRAMEWORK[tag][key].length;
    }
    stats[tag] = count;
    total += count;
  }
  stats._total = total;
  return stats;
}

if (typeof module !== "undefined") {
  module.exports = { CLASSIFIER_FRAMEWORK, classifyHeadline, classify, buildClassifier, getTagSignalMap, getFrameworkStats };
}

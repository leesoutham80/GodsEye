// netlify/functions/meta-intel.js
// Serves meta-intelligence findings from Opus analysis

const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=300"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const metaStore = getStore("godseye-meta");
    const intelRaw = await metaStore.get("meta_intel").catch(() => null);
    
    if (!intelRaw) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          intel: [],
          count: 0,
          message: "No meta-intelligence yet. Longform processor runs daily at 03:00 UTC."
        })
      };
    }

    const intel = JSON.parse(intelRaw);
    
    // Sort newest first
    intel.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    // Calculate stats
    const stats = {
      total_items: intel.length,
      total_contradictions: intel.reduce((sum, i) => sum + (i.analysis?.contradictions?.length || 0), 0),
      total_blind_spots: intel.reduce((sum, i) => sum + (i.analysis?.blind_spots?.length || 0), 0),
      total_opposing: intel.reduce((sum, i) => sum + (i.analysis?.opposing_signals?.length || 0), 0),
      total_systemic: intel.reduce((sum, i) => sum + (i.analysis?.systemic_insights?.length || 0), 0)
    };

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        intel: intel,
        count: intel.length,
        stats: stats,
        ts: Date.now()
      })
    };
  } catch (err) {
    console.error("[META-INTEL] Error:", err);
    console.error("[META-INTEL] Error stack:", err.stack);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to fetch meta-intelligence",
        message: err.message,
        name: err.name
      })
    };
  }
};

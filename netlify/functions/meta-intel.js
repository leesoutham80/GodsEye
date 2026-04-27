// netlify/functions/meta-intel.js
// Serves meta-intelligence findings from Opus analysis

const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=300"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const store = getStore({
      name: "godseye-state",
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.Godseye_Blobs
    });
    const intelRaw = await store.get("meta_intel").catch(() => null);
    
    if (!intelRaw) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ intel: [] })
      };
    }

    const intel = JSON.parse(intelRaw);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        intel: intel,
        count: intel.length,
        updated: new Date().toISOString()
      })
    };

  } catch (err) {
    console.error("[META-INTEL] Error:", err);
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

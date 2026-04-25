// netlify/functions/news-archive.js
// Serves archived headlines from watchdog

const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Cache-Control": "public, max-age=60"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const store = getStore("godseye-state");
    const archiveRaw = await store.get("headlines_archive").catch(() => null);
    
    if (!archiveRaw) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ headlines: [] })
      };
    }

    const archive = JSON.parse(archiveRaw);
    
    // Sort newest first
    const sorted = archive.sort((a, b) => new Date(b.ts) - new Date(a.ts));
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        headlines: sorted,
        count: sorted.length,
        updated: new Date().toISOString()
      })
    };

  } catch (err) {
    console.error("[NEWS-ARCHIVE] Error:", err);
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

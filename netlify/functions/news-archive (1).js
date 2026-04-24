// netlify/functions/news-archive.js
// Serves archived headlines from godseye-news Blob

const { getStore } = require("@netlify/blobs");

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=60"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  try {
    const newsStore = getStore("godseye-news");
    let archiveRaw = null;
    
    try {
      archiveRaw = await newsStore.get("archive");
    } catch (blobErr) {
      console.warn("[NEWS-ARCHIVE] Blob access error:", blobErr.message);
    }
    
    if (!archiveRaw) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          headlines: [],
          count: 0,
          message: "Archive empty. Watchdog will populate on next run."
        })
      };
    }

    const archive = JSON.parse(archiveRaw);
    
    // Sort newest first
    archive.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        headlines: archive,
        count: archive.length,
        oldest: archive[archive.length - 1]?.ts,
        newest: archive[0]?.ts,
        ts: Date.now()
      })
    };
  } catch (err) {
    console.error("[NEWS-ARCHIVE] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: "Failed to fetch archive",
        message: err.message
      })
    };
  }
};

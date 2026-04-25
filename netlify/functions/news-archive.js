const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS"
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  const store = getStore("Godseye_Blobs");
  
  let data = [];
  try {
    const raw = await store.get("headlines_archive");
    if (raw) data = JSON.parse(raw);
  } catch(e) {
    console.error("Archive read failed:", e);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify(data)
  };
};

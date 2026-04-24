// netlify/functions/blob-test.js
// Minimal test to debug Blobs access

const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    console.log("[BLOB-TEST] Attempting getStore...");
    console.log("[BLOB-TEST] Context keys:", Object.keys(context || {}));
    
    const testStore = getStore("godseye-state");
    
    console.log("[BLOB-TEST] getStore succeeded, store created");
    
    // Try to write
    await testStore.set("test-key", "test-value");
    console.log("[BLOB-TEST] Write succeeded");
    
    // Try to read
    const value = await testStore.get("test-key");
    console.log("[BLOB-TEST] Read succeeded, value:", value);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: "Blobs access working",
        value: value
      })
    };
  } catch (err) {
    console.error("[BLOB-TEST] Error:", err);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: err.message,
        stack: err.stack,
        name: err.name
      })
    };
  }
};

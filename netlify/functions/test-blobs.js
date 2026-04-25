const { getStore } = require("@netlify/blobs");

exports.handler = async function(event, context) {
  try {
    const store = getStore("Godseye_Blobs");
    
    // Try to write a simple test value
    await store.set("test", JSON.stringify({ message: "Store initialized", timestamp: new Date().toISOString() }));
    
    // Try to read it back
    const data = await store.get("test");
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, data: data })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
};

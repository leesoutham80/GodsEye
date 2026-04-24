// netlify/functions/longform-cron.js
// Scheduled daily processor for queued long-form content
// Runs at 03:00 UTC daily (off-peak hours)

const { schedule } = require("@netlify/functions");

// Import the processor logic
const processor = require("./longform-processor");

// Schedule: 0 3 * * * = 03:00 UTC every day
module.exports.handler = schedule("0 3 * * *", async (event) => {
  console.log("[LONGFORM-CRON] Running scheduled longform analysis", new Date().toISOString());
  
  try {
    // Call the main processor
    const result = await processor.handler(event);
    
    console.log("[LONGFORM-CRON] Complete:", result.body);
    
    return result;
  } catch (err) {
    console.error("[LONGFORM-CRON] Failed:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
});

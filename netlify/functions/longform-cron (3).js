// netlify/functions/longform-cron.js
// Scheduled daily at 03:00 UTC to process longform queue
// Calls longform-processor to analyze podcasts/articles with Opus

const { schedule } = require("@netlify/functions");

module.exports.handler = schedule("0 3 * * *", async (event) => {
  console.log("[LONGFORM-CRON] Running scheduled processor", new Date().toISOString());

  try {
    // Import and call the longform-processor handler
    const { handler: processHandler } = require("./longform-processor");
    
    // Create a mock event object for POST request
    const mockEvent = {
      httpMethod: "POST",
      headers: {},
      queryStringParameters: {}
    };
    
    const result = await processHandler(mockEvent, {});
    
    console.log("[LONGFORM-CRON] Processing complete:", result.statusCode);
    
    if (result.statusCode === 200) {
      const body = JSON.parse(result.body);
      console.log("[LONGFORM-CRON] Processed:", body.processed, "Remaining:", body.remaining);
    } else {
      console.error("[LONGFORM-CRON] Processing failed:", result.body);
    }
    
    return { statusCode: 200 };
    
  } catch (err) {
    console.error("[LONGFORM-CRON] Error:", err);
    return { statusCode: 500 };
  }
});

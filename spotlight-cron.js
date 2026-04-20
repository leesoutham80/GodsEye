const { schedule } = require('@netlify/functions');
const fetch = require('node-fetch');

// This function runs on a schedule and triggers the main spotlight function
const handler = async (event) => {
  console.log('[SPOTLIGHT-CRON] Triggered at', new Date().toISOString());
  
  try {
    // Get the site URL from environment or construct it
    const siteUrl = process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://godseye-v-60.netlify.app';
    
    // Trigger the main spotlight function
    const response = await fetch(`${siteUrl}/.netlify/functions/spotlight`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cron: true })
    });
    
    if (!response.ok) {
      console.error('[SPOTLIGHT-CRON] Spotlight function returned', response.status);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Spotlight function failed' })
      };
    }
    
    const data = await response.json();
    console.log('[SPOTLIGHT-CRON] Analysis generated successfully');
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Spotlight analysis generated',
        timestamp: new Date().toISOString(),
        success: data.success
      })
    };
    
  } catch (error) {
    console.error('[SPOTLIGHT-CRON] Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Run every 6 hours: "0 */6 * * *"
// This cron expression means: at minute 0 of every 6th hour
module.exports.handler = schedule('0 */6 * * *', handler);

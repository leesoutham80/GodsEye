// netlify/functions/prices.js
// Live price feed for GodsEye dashboard
// Fetches Brent crude futures + other key instruments

const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=60'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const prices = {};
    
    // Yahoo Finance API (free, no key required)
    // Brent Crude front month futures
    const symbols = [
      { yahoo: 'BZ=F', name: 'BRENT' },      // Brent Crude Futures
      { yahoo: 'CL=F', name: 'WTI' },        // WTI Crude Futures
      { yahoo: 'GC=F', name: 'GOLD' },       // Gold Futures
      { yahoo: 'BTC-USD', name: 'BTC' },     // Bitcoin
      { yahoo: 'DX-Y.NYB', name: 'DXY' },    // Dollar Index
      { yahoo: 'EURUSD=X', name: 'EUR/USD' },
      { yahoo: 'GBPUSD=X', name: 'GBP/USD' },
      { yahoo: 'JPY=X', name: 'USD/JPY' },
      { yahoo: '^GSPC', name: 'S&P 500' },
      { yahoo: '^FTSE', name: 'FTSE 100' },
      { yahoo: '^VIX', name: 'VIX' }
    ];

    // Fetch all in parallel
    const results = await Promise.allSettled(
      symbols.map(async (sym) => {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym.yahoo}?interval=1m&range=1d`;
        const res = await fetch(url, { 
          headers: { 'User-Agent': 'GodsEye/1.0' },
          signal: AbortSignal.timeout(3000)
        });
        
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const data = await res.json();
        const quote = data.chart.result[0].meta;
        const price = quote.regularMarketPrice;
        const prev = quote.previousClose;
        const change = ((price - prev) / prev * 100);
        
        return {
          name: sym.name,
          price: price,
          change: change,
          previous: prev
        };
      })
    );

    // Process results
    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        prices[data.name] = {
          p: formatPrice(data.name, data.price),
          raw: data.price,
          c: formatChange(data.change),
          u: data.change >= 0 ? 1 : 0
        };
      }
    });

    // Return
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        prices: prices,
        ts: Date.now(),
        source: 'yahoo_finance',
        count: Object.keys(prices).length
      })
    };

  } catch (err) {
    console.error('[PRICES] Error:', err.message);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: err.message,
        prices: {},
        ts: Date.now()
      })
    };
  }
};

function formatPrice(name, price) {
  if (name === 'BRENT' || name === 'WTI' || name === 'GOLD') {
    return '$' + price.toFixed(2);
  }
  if (name === 'BTC') {
    return '$' + Math.round(price).toLocaleString();
  }
  if (name.includes('USD') || name === 'DXY') {
    return price.toFixed(2);
  }
  if (name === 'VIX') {
    return price.toFixed(1);
  }
  return Math.round(price).toLocaleString();
}

function formatChange(change) {
  const sign = change >= 0 ? '+' : '';
  return sign + change.toFixed(2) + '%';
}

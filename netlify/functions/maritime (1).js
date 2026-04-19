const fetch = require('node-fetch');

// Free-tier maritime intelligence sources
// VesselFinder and MarineTraffic require API keys (paid)
// Using publicly available data and scraping where legal

exports.handler = async (event, context) => {
  try {
    const maritimeData = {
      hormuz_transits: null,
      anchorage_count: null,
      ais_hesitation: null,
      sources_active: 0,
      timestamp: new Date().toISOString()
    };
    
    // 1. Global Fishing Watch (free tier with API key)
    if (process.env.GFW_TOKEN) {
      try {
        // Hormuz area: roughly 25-27°N, 55-57°E
        const url = `https://gateway.api.globalfishingwatch.org/v2/vessels?datasets=public-global-fishing-vessels:latest&includes=OWNERSHIP&query=geom:POLYGON((55 25,57 25,57 27,55 27,55 25))`;
        
        const res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${process.env.GFW_TOKEN}`
          }
        });
        
        if (res.ok) {
          const data = await res.json();
          maritimeData.fishing_vessels_hormuz = data.total || 0;
          maritimeData.sources_active++;
        }
      } catch (e) {
        console.warn('[GFW] Error:', e.message);
      }
    }
    
    // 2. AIS Hub (free, limited)
    // Public feed available at http://data.aishub.net/ws.php
    // Requires free API key from aishub.net
    if (process.env.AISHUB_KEY) {
      try {
        // Hormuz chokepoint area
        const url = `http://data.aishub.net/ws.php?username=${process.env.AISHUB_KEY}&format=1&output=json&compress=0&latmin=25&latmax=27&lonmin=55&lonmax=57`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (data && data[0] && data[0].POSITION) {
            maritimeData.ais_contacts = data[0].POSITION.length;
            maritimeData.sources_active++;
          }
        }
      } catch (e) {
        console.warn('[AISHub] Error:', e.message);
      }
    }
    
    // 3. MarineTraffic public API (if key available)
    if (process.env.MARINETRAFFIC_KEY) {
      try {
        // Simple bounding box query
        const url = `https://services.marinetraffic.com/api/exportvessels/v:8/${process.env.MARINETRAFFIC_KEY}/timespan:10/protocol:json/minlat:25/maxlat:27/minlon:55/maxlon:57`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          maritimeData.vessels_24h = data.length || 0;
          maritimeData.sources_active++;
        }
      } catch (e) {
        console.warn('[MarineTraffic] Error:', e.message);
      }
    }
    
    // 4. VesselFinder (if key available)
    if (process.env.VESSELFINDER_KEY) {
      try {
        const url = `https://api.vesselfinder.com/vesselslist?userkey=${process.env.VESSELFINDER_KEY}&sat=0&minlat=25&maxlat=27&minlon=55&maxlon=57`;
        
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          maritimeData.vessels_live = data.length || 0;
          maritimeData.sources_active++;
        }
      } catch (e) {
        console.warn('[VesselFinder] Error:', e.message);
      }
    }
    
    // Calculate derived signals if we have data
    if (maritimeData.sources_active > 0) {
      // S3 Transit Count - requires historical baseline
      // For now, just pass through raw counts
      
      // S14 Anchorage Congestion - needs Singapore/Fujairah data
      // Would require separate API calls with different coordinates
      
      // S32 AIS Herd Hesitation - needs velocity/course analysis
      // Complex calculation requiring vessel tracking over time
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300' // 5 min cache
      },
      body: JSON.stringify({
        success: maritimeData.sources_active > 0,
        data: maritimeData,
        signals: {
          S3: null,  // Transit Count - needs implementation
          S14: null, // Anchorage Congestion - needs implementation  
          S32: null, // AIS Hesitation - needs implementation
          S84: maritimeData.fishing_vessels_hormuz || null // Fishing Ground Denial
        },
        timestamp: maritimeData.timestamp
      })
    };
    
  } catch (error) {
    console.error('[MARITIME] Fatal error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

(function () {
  if (!window.App) throw new Error('App state not initialized');

  // US cities guaranteed to be on land - used for deterministic hospital placement
  const US_CITIES = [
    { lon: -122.4194, lat: 37.7749 },  // San Francisco, CA
    { lon: -118.2437, lat: 34.0522 },  // Los Angeles, CA
    { lon: -117.1611, lat: 32.7157 },  // San Diego, CA
    { lon: -121.4944, lat: 38.5816 },  // Sacramento, CA
    { lon: -122.3321, lat: 47.6062 },  // Seattle, WA
    { lon: -122.6765, lat: 45.5152 },  // Portland, OR
    { lon: -112.0740, lat: 33.4484 },  // Phoenix, AZ
    { lon: -111.8910, lat: 40.7608 },  // Salt Lake City, UT
    { lon: -104.9903, lat: 39.7392 },  // Denver, CO
    { lon: -106.6504, lat: 35.0844 },  // Albuquerque, NM
    { lon: -115.1398, lat: 36.1699 },  // Las Vegas, NV
    { lon: -95.3698, lat: 29.7604 },   // Houston, TX
    { lon: -97.7431, lat: 30.2672 },   // Austin, TX
    { lon: -96.7970, lat: 32.7767 },   // Dallas, TX
    { lon: -98.4936, lat: 29.4241 },   // San Antonio, TX
    { lon: -97.3308, lat: 32.7555 },   // Fort Worth, TX
    { lon: -90.0715, lat: 29.9511 },   // New Orleans, LA
    { lon: -86.7816, lat: 36.1627 },   // Nashville, TN
    { lon: -90.0490, lat: 35.1495 },   // Memphis, TN
    { lon: -84.3880, lat: 33.7490 },   // Atlanta, GA
    { lon: -81.6557, lat: 30.3322 },   // Jacksonville, FL
    { lon: -80.1918, lat: 25.7617 },   // Miami, FL
    { lon: -82.4572, lat: 27.9506 },   // Tampa, FL
    { lon: -81.3792, lat: 28.5383 },   // Orlando, FL
    { lon: -78.6382, lat: 35.7796 },   // Raleigh, NC
    { lon: -80.8431, lat: 35.2271 },   // Charlotte, NC
    { lon: -79.9311, lat: 32.7765 },   // Charleston, SC
    { lon: -77.0369, lat: 38.9072 },   // Washington, DC
    { lon: -76.6122, lat: 39.2904 },   // Baltimore, MD
    { lon: -75.1652, lat: 39.9526 },   // Philadelphia, PA
    { lon: -79.9959, lat: 40.4406 },   // Pittsburgh, PA
    { lon: -74.0060, lat: 40.7128 },   // New York City, NY
    { lon: -73.7562, lat: 42.6526 },   // Albany, NY
    { lon: -78.8784, lat: 42.8864 },   // Buffalo, NY
    { lon: -71.0589, lat: 42.3601 },   // Boston, MA
    { lon: -71.4128, lat: 41.8240 },   // Providence, RI
    { lon: -72.6851, lat: 41.7658 },   // Hartford, CT
    { lon: -73.2121, lat: 44.4759 },   // Burlington, VT
    { lon: -71.4548, lat: 43.2081 },   // Concord, NH
    { lon: -69.7795, lat: 44.3106 },   // Augusta, ME
    { lon: -83.0458, lat: 42.3314 },   // Detroit, MI
    { lon: -85.6681, lat: 42.9634 },   // Grand Rapids, MI
    { lon: -87.6298, lat: 41.8781 },   // Chicago, IL
    { lon: -89.6501, lat: 39.7817 },   // Springfield, IL
    { lon: -86.1581, lat: 39.7684 },   // Indianapolis, IN
    { lon: -81.6944, lat: 41.4993 },   // Cleveland, OH
    { lon: -82.9988, lat: 39.9612 },   // Columbus, OH
    { lon: -84.5120, lat: 39.1031 },   // Cincinnati, OH
    { lon: -87.9065, lat: 43.0389 },   // Milwaukee, WI
    { lon: -89.4012, lat: 43.0731 },   // Madison, WI
    { lon: -93.2650, lat: 44.9778 },   // Minneapolis, MN
    { lon: -93.0900, lat: 44.9537 },   // St. Paul, MN
    { lon: -93.6091, lat: 41.5868 },   // Des Moines, IA
    { lon: -95.9345, lat: 41.2565 },   // Omaha, NE
    { lon: -96.7898, lat: 46.8772 },   // Fargo, ND
    { lon: -100.7837, lat: 46.8083 }, // Bismarck, ND
    { lon: -96.7311, lat: 43.5460 },   // Sioux Falls, SD
    { lon: -94.5786, lat: 39.0997 },   // Kansas City, MO
    { lon: -90.1994, lat: 38.6270 },   // St. Louis, MO
    { lon: -97.3301, lat: 37.6872 },   // Wichita, KS
    { lon: -95.6780, lat: 39.0558 },   // Topeka, KS
    { lon: -97.5164, lat: 35.4676 },   // Oklahoma City, OK
    { lon: -95.9928, lat: 36.1540 },   // Tulsa, OK
    { lon: -92.2896, lat: 34.7465 },   // Little Rock, AR
    { lon: -85.7585, lat: 38.2527 },   // Louisville, KY
    { lon: -84.5037, lat: 38.0406 },   // Lexington, KY
    { lon: -86.8025, lat: 33.5207 },   // Birmingham, AL
    { lon: -88.0399, lat: 30.6954 },   // Mobile, AL
    { lon: -90.1848, lat: 32.2988 },   // Jackson, MS
    { lon: -110.9747, lat: 32.2226 },  // Tucson, AZ
    { lon: -116.2023, lat: 43.6150 },  // Boise, ID
    { lon: -109.7508, lat: 45.7833 },  // Billings, MT
    { lon: -105.9378, lat: 35.6870 },  // Santa Fe, NM
    { lon: -104.8214, lat: 38.8339 },  // Colorado Springs, CO
    { lon: -119.8138, lat: 39.5296 },  // Reno, NV
    { lon: -123.0868, lat: 44.0521 },  // Eugene, OR
  ];

  // Deterministic hash for stable placement
  function hashStringToIndex(str, max) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % max;
  }

  function hospitalToLonLat(hospitalName) {
    const name = hospitalName || 'Unknown';
    const index = hashStringToIndex(name, US_CITIES.length);
    const baseCity = US_CITIES[index];
    
    // Add small deterministic offset to avoid exact overlap when multiple hospitals map to same city
    const offsetHash = hashStringToIndex(name + '::offset', 10000);
    const offsetLon = ((offsetHash % 100) - 50) * 0.002;  // ~±0.1 degrees
    const offsetLat = (Math.floor(offsetHash / 100) - 50) * 0.002;
    
    return {
      lon: baseCity.lon + offsetLon,
      lat: baseCity.lat + offsetLat
    };
  }

  window.App.utils = window.App.utils || {};
  window.App.utils.geo = { hospitalToLonLat };
})();

const fs = require('fs');
const schools = JSON.parse(fs.readFileSync('mcp-server/data/schools.json', 'utf8'));
const potholes = JSON.parse(fs.readFileSync('mcp-server/data/potholes.json', 'utf8'));
const sidewalks = JSON.parse(fs.readFileSync('mcp-server/data/sidewalk-issues.json', 'utf8'));

function haversineFt(lat1, lon1, lat2, lon2) {
  const R = 20902231; // Earth radius in feet
  const toRad = x => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearest(lat, lng) {
  let best = { dist: Infinity, name: null, walkZone: 0 };
  let bestInZone = null; // closest school whose walk zone covers this point
  for (const s of schools) {
    const d = haversineFt(lat, lng, s.location.lat, s.location.lng);
    if (d < best.dist) {
      best = { dist: Math.round(d), name: s.name, walkZone: s.walk_zone_radius_ft };
    }
    // Track if this point is within ANY school's walk zone
    if (d <= s.walk_zone_radius_ft && (!bestInZone || d < bestInZone.dist)) {
      bestInZone = { dist: Math.round(d), name: s.name, walkZone: s.walk_zone_radius_ft };
    }
  }
  // Prefer a school whose walk zone covers this point over just the nearest school
  return bestInZone || best;
}

console.log('=== POTHOLES ===');
for (const p of potholes) {
  const n = nearest(p.location.lat, p.location.lng);
  p.school_distance_ft = n.dist;
  p.near_school = n.dist <= n.walkZone;
  p.school_name = p.near_school ? n.name : null;
  console.log(`${p.id}: ${n.name} @ ${n.dist} ft -> near=${p.near_school}`);
}

console.log('\n=== SIDEWALKS ===');
for (const s of sidewalks) {
  const n = nearest(s.location.lat, s.location.lng);
  s.school_distance_ft = n.dist;
  s.near_school = n.dist <= n.walkZone;
  s.school_name = s.near_school ? n.name : null;
  console.log(`${s.id}: ${n.name} @ ${n.dist} ft -> near=${s.near_school}`);
}

fs.writeFileSync('mcp-server/data/potholes.json', JSON.stringify(potholes, null, 2));
fs.writeFileSync('mcp-server/data/sidewalk-issues.json', JSON.stringify(sidewalks, null, 2));
console.log('\nFiles updated!');

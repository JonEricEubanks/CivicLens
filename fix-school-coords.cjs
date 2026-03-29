/**
 * fix-school-coords.cjs
 * Queries the Overpass API for school buildings in Lake Forest, IL
 * and computes building polygon centroids to update schools.json
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

// Lake Forest bounding box (south, west, north, east)
const LF_BBOX = '42.20,-87.90,42.28,-87.80';

// Overpass query: find all nodes/ways/relations tagged amenity=school in Lake Forest
const OVERPASS_QUERY = `
[out:json][timeout:30];
(
  way["amenity"="school"](${LF_BBOX});
  relation["amenity"="school"](${LF_BBOX});
  node["amenity"="school"](${LF_BBOX});
);
out center body;
>;
out skel qt;
`;

function fetch(url, postData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: postData ? 'POST' : 'GET',
      headers: postData ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== Querying Overpass API for schools in Lake Forest, IL ===\n');

  const raw = await fetch(
    'https://overpass-api.de/api/interpreter',
    'data=' + encodeURIComponent(OVERPASS_QUERY)
  );
  const result = JSON.parse(raw);

  // Collect all nodes for way geometry computation
  const nodeMap = {};
  for (const el of result.elements) {
    if (el.type === 'node') {
      nodeMap[el.id] = { lat: el.lat, lon: el.lon };
    }
  }

  // Extract schools (ways and relations with center, or nodes)
  const schools = [];
  for (const el of result.elements) {
    if (!el.tags || !el.tags.amenity) continue;
    if (el.tags.amenity !== 'school') continue;

    let lat, lon;
    if (el.type === 'node') {
      lat = el.lat;
      lon = el.lon;
    } else if (el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    } else if (el.type === 'way' && el.nodes) {
      // Compute centroid from node refs
      let sumLat = 0, sumLon = 0, count = 0;
      for (const nid of el.nodes) {
        if (nodeMap[nid]) {
          sumLat += nodeMap[nid].lat;
          sumLon += nodeMap[nid].lon;
          count++;
        }
      }
      if (count > 0) {
        lat = sumLat / count;
        lon = sumLon / count;
      }
    }

    if (lat && lon) {
      schools.push({
        id: el.id,
        type: el.type,
        name: el.tags.name || '(unnamed)',
        lat,
        lon,
        tags: el.tags
      });
    }
  }

  console.log(`Found ${schools.length} school features:\n`);
  for (const s of schools) {
    console.log(`  ${s.name}`);
    console.log(`    Type: ${s.type} #${s.id}`);
    console.log(`    Center: ${s.lat.toFixed(7)}, ${s.lon.toFixed(7)}`);
    if (s.tags.addr_street || s.tags['addr:street']) {
      console.log(`    Address: ${s.tags['addr:housenumber'] || ''} ${s.tags['addr:street'] || ''}`);
    }
    console.log();
  }

  // Now also query for building=school polygons for more precise building footprints
  console.log('\n=== Querying building=school polygons ===\n');
  const BUILDING_QUERY = `
[out:json][timeout:30];
(
  way["building"="school"](${LF_BBOX});
  relation["building"="school"](${LF_BBOX});
);
out center body;
>;
out skel qt;
`;
  const rawB = await fetch(
    'https://overpass-api.de/api/interpreter',
    'data=' + encodeURIComponent(BUILDING_QUERY)
  );
  const resultB = JSON.parse(rawB);

  const buildingNodeMap = {};
  for (const el of resultB.elements) {
    if (el.type === 'node') {
      buildingNodeMap[el.id] = { lat: el.lat, lon: el.lon };
    }
  }

  const buildings = [];
  for (const el of resultB.elements) {
    if (el.type === 'node') continue;
    let lat, lon;
    if (el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    } else if (el.type === 'way' && el.nodes) {
      let sumLat = 0, sumLon = 0, count = 0;
      for (const nid of el.nodes) {
        if (buildingNodeMap[nid]) {
          sumLat += buildingNodeMap[nid].lat;
          sumLon += buildingNodeMap[nid].lon;
          count++;
        }
      }
      if (count > 0) {
        lat = sumLat / count;
        lon = sumLon / count;
      }
    }
    if (lat && lon) {
      buildings.push({
        id: el.id,
        type: el.type,
        name: el.tags?.name || '(unnamed)',
        lat,
        lon,
        tags: el.tags || {}
      });
    }
  }

  console.log(`Found ${buildings.length} building=school polygons:\n`);
  for (const b of buildings) {
    console.log(`  ${b.name} (${b.type} #${b.id})`);
    console.log(`    Center: ${b.lat.toFixed(7)}, ${b.lon.toFixed(7)}`);
    console.log();
  }

  // Match our 5 schools
  const TARGET_SCHOOLS = [
    { id: 'SCH-001', name: 'Deer Path Middle School', keywords: ['deer path', 'deerpath'] },
    { id: 'SCH-002', name: 'Lake Forest High School', keywords: ['lake forest high', 'lfhs'] },
    { id: 'SCH-003', name: 'Everett Elementary School', keywords: ['everett'] },
    { id: 'SCH-004', name: 'Cherokee Elementary School', keywords: ['cherokee'] },
    { id: 'SCH-005', name: 'Sheridan Elementary School', keywords: ['sheridan'] }
  ];

  console.log('\n=== MATCHING RESULTS ===\n');
  const allFeatures = [...schools, ...buildings];
  const matches = {};

  for (const target of TARGET_SCHOOLS) {
    const found = allFeatures.filter(f => {
      const n = f.name.toLowerCase();
      return target.keywords.some(k => n.includes(k));
    });
    if (found.length > 0) {
      // Prefer the building polygon (smaller, more precise) over the school ground
      // Pick the one with type 'way' over 'relation' if building=school exists
      const buildingMatch = found.find(f => f.tags?.building === 'school');
      const best = buildingMatch || found[0];
      matches[target.id] = { ...target, match: best };
      console.log(`✓ ${target.name}`);
      console.log(`  Matched: ${best.name} (${best.type} #${best.id})`);
      console.log(`  Coords:  ${best.lat.toFixed(7)}, ${best.lon.toFixed(7)}`);
    } else {
      console.log(`✗ ${target.name} — NO MATCH`);
      matches[target.id] = null;
    }
    console.log();
  }

  // Update schools.json
  const schoolsPath = path.join(__dirname, 'mcp-server', 'data', 'schools.json');
  const schoolsData = JSON.parse(fs.readFileSync(schoolsPath, 'utf-8'));

  let updated = 0;
  for (const school of schoolsData) {
    const m = matches[school.id];
    if (m && m.match) {
      const oldLat = school.location.lat;
      const oldLng = school.location.lng;
      school.location.lat = parseFloat(m.match.lat.toFixed(7));
      school.location.lng = parseFloat(m.match.lon.toFixed(7));
      console.log(`Updated ${school.name}:`);
      console.log(`  OLD: ${oldLat}, ${oldLng}`);
      console.log(`  NEW: ${school.location.lat}, ${school.location.lng}`);
      updated++;
    }
  }

  if (updated > 0) {
    fs.writeFileSync(schoolsPath, JSON.stringify(schoolsData, null, 2));
    console.log(`\n✓ Updated ${updated} schools in schools.json`);
  } else {
    console.log('\n⚠ No schools were updated');
  }
}

main().catch(err => {
  console.error('ERROR:', err.message);
  process.exit(1);
});

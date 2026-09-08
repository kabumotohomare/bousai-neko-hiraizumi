// OSM の地図 XML から public/data/roads.json を作り直す。
//   pnpm data:roads
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toRoadsFromOsmXml } from '../src/services/transform/toRoadsFromOsmXml.ts';

const BOUNDS = { south: 38.983, west: 141.108, north: 38.996, east: 141.125 };
const OSM_URL = `https://api.openstreetmap.org/api/0.6/map?bbox=${BOUNDS.west},${BOUNDS.south},${BOUNDS.east},${BOUNDS.north}`;
const rawDir = fileURLToPath(new URL('../data/raw/', import.meta.url));
const xmlPath = fileURLToPath(new URL('../data/raw/osm-map.xml', import.meta.url));
const jsonPath = fileURLToPath(new URL('../public/data/roads.json', import.meta.url));
const configPath = fileURLToPath(new URL('../public/data/game-config.json', import.meta.url));

async function readOsmXml() {
  if (existsSync(xmlPath)) {
    return readFileSync(xmlPath, 'utf8');
  }

  const response = await fetch(OSM_URL, {
    headers: {
      'User-Agent': 'bousai-neko-hiraizumi/0.1 (roads bake; local data pipeline)'
    }
  });
  if (!response.ok) {
    throw new Error(`OSM map API failed: ${response.status}`);
  }

  const xml = await response.text();
  mkdirSync(rawDir, { recursive: true });
  writeFileSync(xmlPath, xml, 'utf8');
  return xml;
}

const config = JSON.parse(readFileSync(configPath, 'utf8'));
const xml = await readOsmXml();
const roads = toRoadsFromOsmXml(xml, config.defaultMapCenter);
writeFileSync(jsonPath, `${JSON.stringify(roads, null, 2)}\n`, 'utf8');
console.log(`roads.json を更新しました: ${roads.length}本`);

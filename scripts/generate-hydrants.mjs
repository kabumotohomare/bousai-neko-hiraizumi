// 平泉町オープンデータのCSVから public/data/hydrants.json を作り直す。
//   pnpm data:hydrants
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { toHydrantsFromCsv } from '../src/services/transform/toHydrantsFromCsv.ts';

const csvPath = fileURLToPath(new URL('../data/raw/13.消防水利施設一覧.csv', import.meta.url));
const jsonPath = fileURLToPath(new URL('../public/data/hydrants.json', import.meta.url));

const hydrants = toHydrantsFromCsv(readFileSync(csvPath, 'utf8'));
writeFileSync(jsonPath, `${JSON.stringify(hydrants, null, 2)}\n`, 'utf8');

console.log(`hydrants.json を更新しました: ${hydrants.length}件`);

// scripts/generate-hydrants.mjs から Node で直接読むため、拡張子まで書く。
import { type Hydrant, HydrantsSchema } from '../../domain/hydrant/model.ts';

/** 平泉町オープンデータ「13.消防水利施設一覧.csv」のうち、この種別だけをゲームに取り込む。 */
const HYDRANT_KIND = '消火栓';

const COLUMNS = {
  kind: '種別',
  area: '所在地_町字',
  block: '所在地_番地以下',
  lat: '緯度',
  lng: '経度',
  sourceId: '備考'
} as const;

function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (inQuotes) {
      if (char !== '"') {
        field += char;
      } else if (source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = false;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function toColumnIndexes(header: string[]): Record<keyof typeof COLUMNS, number> {
  const entries = Object.entries(COLUMNS).map(([key, label]) => {
    const index = header.indexOf(label);
    if (index < 0) {
      throw new Error(`消防水利施設CSVに列「${label}」がありません。`);
    }
    return [key, index] as const;
  });

  return Object.fromEntries(entries) as Record<keyof typeof COLUMNS, number>;
}

function toHydrantName(area: string, block: string, sourceId: string): string {
  const shortArea = area.replace(/^平泉字/, '');
  if (!shortArea) {
    return `消火栓 ${sourceId}`;
  }
  return `${shortArea}${block}の消火栓`;
}

/**
 * 消防水利施設一覧CSVから、種別が消火栓の行だけを Hydrant に変換する。
 * 緯度経度が欠けている行は、開発仕様18.3にしたがって除外する。
 */
export function toHydrantsFromCsv(csvText: string): Hydrant[] {
  const [header, ...rows] = parseCsv(csvText);
  if (!header) {
    return [];
  }

  const index = toColumnIndexes(header);

  const hydrants = rows.flatMap((row, rowNumber) => {
    const valueAt = (column: keyof typeof COLUMNS) => (row[index[column]] ?? '').trim();

    if (valueAt('kind') !== HYDRANT_KIND) {
      return [];
    }

    const lat = Number.parseFloat(valueAt('lat'));
    const lng = Number.parseFloat(valueAt('lng'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return [];
    }

    const sourceId = valueAt('sourceId') || `row-${rowNumber + 1}`;

    return [
      {
        // 取り込み直しでもIDが変わらないよう、行順ではなく元データの識別子から作る。
        id: `hydrant_${sourceId}`,
        sourceId,
        name: toHydrantName(valueAt('area'), valueAt('block'), sourceId),
        lat,
        lng,
        // 平泉町の消火栓は地上式を前提とする。CSVに形式の列はない。
        type: 'ground' as const,
        status: 'active' as const
      }
    ];
  });

  return HydrantsSchema.parse(hydrants);
}

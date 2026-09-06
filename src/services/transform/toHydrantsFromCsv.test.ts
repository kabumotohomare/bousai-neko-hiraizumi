import { describe, expect, it } from 'vitest';
import { toHydrantsFromCsv } from './toHydrantsFromCsv';

const HEADER = '種別,所在地_町字,所在地_番地以下,緯度,経度,備考';

function csv(...rows: string[]): string {
  return `\uFEFF${[HEADER, ...rows].join('\r\n')}\r\n`;
}

describe('toHydrantsFromCsv', () => {
  it('keeps only 消火栓 rows', () => {
    const hydrants = toHydrantsFromCsv(
      csv(
        '消火栓,平泉字志羅山,3番地,38.9885159157107,141.1160787797050,1-3',
        '防火水槽,平泉字泉屋,14番地,38.9863464631357,141.1165229289340,2-1'
      )
    );

    expect(hydrants).toHaveLength(1);
    expect(hydrants[0]).toEqual({
      id: 'hydrant_1-3',
      sourceId: '1-3',
      name: '志羅山3番地の消火栓',
      lat: 38.9885159157107,
      lng: 141.116078779705,
      type: 'ground',
      status: 'active'
    });
  });

  it('drops rows without usable coordinates', () => {
    const hydrants = toHydrantsFromCsv(
      csv('消火栓,平泉字鈴沢,,,,1-9', '消火栓,平泉字鈴沢,10番地3,38.9884,141.1167,1-5')
    );

    expect(hydrants.map((hydrant) => hydrant.sourceId)).toEqual(['1-5']);
  });

  it('names a hydrant by area alone when the block is empty', () => {
    const [hydrant] = toHydrantsFromCsv(csv('消火栓,平泉字志羅山,,38.9874,141.1159,1-2'));

    expect(hydrant.name).toBe('志羅山の消火栓');
  });

  it('reads quoted fields that contain a comma', () => {
    const [hydrant] = toHydrantsFromCsv(
      csv('消火栓,"平泉字鈴沢,西側",66番地1,38.9891,141.1132,1-39')
    );

    expect(hydrant.name).toBe('鈴沢,西側66番地1の消火栓');
  });

  it('throws when a required column is missing', () => {
    expect(() => toHydrantsFromCsv('種別,緯度,経度\n消火栓,38.9,141.1\n')).toThrow('所在地_町字');
  });
});

import { describe, expect, it } from 'vitest';
import { toRoadsFromOsmXml } from './toRoadsFromOsmXml';

const ORIGIN = { lat: 38.9899314, lng: 141.1152492 };

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<osm version="0.6">
  <node id="1" lat="38.9900" lon="141.1150"/>
  <node id="2" lat="38.9905" lon="141.1150"/>
  <node id="3" lat="38.9910" lon="141.1155"/>
  <way id="10">
    <nd ref="1"/>
    <nd ref="2"/>
    <nd ref="3"/>
    <tag k="highway" v="residential"/>
    <tag k="name" v="テスト通り"/>
  </way>
  <way id="11">
    <nd ref="1"/>
    <nd ref="2"/>
    <tag k="highway" v="footway"/>
  </way>
  <way id="12">
    <nd ref="1"/>
    <nd ref="2"/>
    <tag k="highway" v="residential"/>
    <tag k="area" v="yes"/>
  </way>
</osm>`;

describe('toRoadsFromOsmXml', () => {
  it('keeps playable highway types and drops footways and areas', () => {
    const roads = toRoadsFromOsmXml(SAMPLE_XML, ORIGIN);
    expect(roads).toHaveLength(1);
    expect(roads[0]).toMatchObject({
      id: 'road_10',
      sourceId: '10',
      highway: 'residential',
      name: 'テスト通り',
      width: 4.5
    });
    expect(roads[0].path.length).toBeGreaterThanOrEqual(2);
    expect(roads[0].path[0].lat).toBeCloseTo(38.99, 4);
    expect(roads[0].path[0].lng).toBeCloseTo(141.115, 4);
  });

  it('skips ways that reference missing nodes', () => {
    const xml = `<?xml version="1.0"?>
      <osm>
        <node id="1" lat="38.99" lon="141.115"/>
        <way id="99">
          <nd ref="1"/>
          <nd ref="404"/>
          <tag k="highway" v="service"/>
        </way>
      </osm>`;
    expect(toRoadsFromOsmXml(xml, ORIGIN)).toEqual([]);
  });
});

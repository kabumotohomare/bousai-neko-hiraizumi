import { describe, expect, it } from 'vitest';
import { latLngToWorldPosition } from './latLngToWorldPosition';
import { osmTileToLat, osmTileToLng } from './osmTiles';
import { TOWN_MAPNIK_TILES, toTownModelTransform } from './townModelPlacement';

describe('toTownModelTransform', () => {
  const origin = { lat: 38.9899314, lng: 141.1152492 };
  const mapnikBox = {
    minX: -985.5447235107422,
    maxX: 1154.691909790039,
    minZ: -743.8411407470703,
    maxZ: 784.8993988037109
  };

  it('maps the Mapnik plane corners onto the OSM tile bbox in game space', () => {
    const transform = toTownModelTransform(mapnikBox, origin);
    const west = osmTileToLng(TOWN_MAPNIK_TILES.x, TOWN_MAPNIK_TILES.zoom);
    const east = osmTileToLng(
      TOWN_MAPNIK_TILES.x + TOWN_MAPNIK_TILES.tileCountX,
      TOWN_MAPNIK_TILES.zoom
    );
    const north = osmTileToLat(TOWN_MAPNIK_TILES.y, TOWN_MAPNIK_TILES.zoom);
    const south = osmTileToLat(
      TOWN_MAPNIK_TILES.y + TOWN_MAPNIK_TILES.tileCountY,
      TOWN_MAPNIK_TILES.zoom
    );
    const nw = latLngToWorldPosition(north, west, origin);
    const se = latLngToWorldPosition(south, east, origin);

    expect(mapnikBox.minX * transform.scaleX + transform.x).toBeCloseTo(nw.x, 6);
    expect(mapnikBox.minZ * transform.scaleZ + transform.z).toBeCloseTo(nw.z, 6);
    expect(mapnikBox.maxX * transform.scaleX + transform.x).toBeCloseTo(se.x, 6);
    expect(mapnikBox.maxZ * transform.scaleZ + transform.z).toBeCloseTo(se.z, 6);
    expect(transform.scaleX).toBeCloseTo(Math.cos((origin.lat * Math.PI) / 180), 2);
  });
});

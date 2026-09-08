import { latLngToWorldPosition } from './latLngToWorldPosition';
import { osmTileToLat, osmTileToLng } from './osmTiles';

/** hiraizumi-town.glb 内 Mapnik プレーンが焼いている OSM タイル範囲。 */
export const TOWN_MAPNIK_TILES = {
  zoom: 17,
  x: 116911,
  y: 50095,
  tileCountX: 7,
  tileCountY: 5
} as const;

export interface XzBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TownModelTransform {
  x: number;
  z: number;
  scaleX: number;
  scaleZ: number;
}

export function toTownModelTransform(
  mapnikBox: XzBox,
  origin: { lat: number; lng: number }
): TownModelTransform {
  const spanX = mapnikBox.maxX - mapnikBox.minX;
  const spanZ = mapnikBox.maxZ - mapnikBox.minZ;
  if (spanX <= 0 || spanZ <= 0) {
    return { x: 0, z: 0, scaleX: 1, scaleZ: 1 };
  }

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
  const ne = latLngToWorldPosition(north, east, origin);
  const sw = latLngToWorldPosition(south, west, origin);
  const scaleX = (ne.x - nw.x) / spanX;
  const scaleZ = (sw.z - nw.z) / spanZ;

  return {
    x: nw.x - mapnikBox.minX * scaleX,
    z: nw.z - mapnikBox.minZ * scaleZ,
    scaleX,
    scaleZ
  };
}

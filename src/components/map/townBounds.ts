import L from 'leaflet';
import { GameConfig } from '../../domain/common/config';

export function toTownBounds(mapBounds: GameConfig['mapBounds']): L.LatLngBounds {
  return L.latLngBounds(
    [mapBounds.southWest.lat, mapBounds.southWest.lng],
    [mapBounds.northEast.lat, mapBounds.northEast.lng]
  );
}

export function clampMapToTown(map: L.Map, townBounds: L.LatLngBounds): void {
  map.invalidateSize();
  map.setMaxBounds(townBounds);

  const minZoom = map.getBoundsZoom(townBounds, true);
  if (!Number.isFinite(minZoom)) {
    return;
  }

  map.setMinZoom(minZoom);
  if (map.getZoom() < minZoom) {
    map.setZoom(minZoom);
  }
}

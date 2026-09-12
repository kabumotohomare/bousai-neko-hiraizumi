import { GameBuilding, OverlayBuilding, OverlayCatalog, OverlayFace, ProjectMeta } from './project';

export const EXPORT_SIZE = 500;

export function padFaceId(value: number): string {
  return String(value).padStart(2, '0');
}

export function nextFaceId(faces: OverlayFace[]): string {
  const used = new Set(
    faces
      .map((face) => Number.parseInt(face.face_id, 10))
      .filter((n) => Number.isFinite(n) && n > 0)
  );
  let n = 1;
  while (used.has(n)) {
    n += 1;
  }
  return padFaceId(n);
}

export function toExportFileName(buildingId: string, faceId: string): string {
  return `building_${buildingId}_face_${faceId}.png`;
}

export function parseExportFileName(
  fileName: string
): { buildingId: string; faceId: string } | null {
  const match = /^building_(.+)_face_([0-9]{2})\.png$/i.exec(fileName);
  if (!match) {
    return null;
  }
  return { buildingId: match[1], faceId: match[2] };
}

export function createEmptyProjectMeta(name: string, now = new Date().toISOString()): ProjectMeta {
  return {
    schemaVersion: 1,
    name,
    referenceImageRelPath: null,
    colorMatchScope: 'project',
    createdAt: now,
    updatedAt: now
  };
}

export function createEmptyOverlay(): OverlayCatalog {
  return { schemaVersion: 1, buildings: [] };
}

export function overlayFromGameBuildings(gameBuildings: GameBuilding[]): OverlayCatalog {
  return {
    schemaVersion: 1,
    buildings: gameBuildings.map((building) => ({
      building_id: building.id,
      name: building.name,
      lat: building.lat,
      lng: building.lng,
      isShootTarget: false,
      pendingGameId: false,
      faces: []
    }))
  };
}

export function mergeGameAndOverlay(
  gameBuildings: GameBuilding[],
  overlay: OverlayCatalog
): OverlayCatalog {
  const byId = new Map(overlay.buildings.map((building) => [building.building_id, building]));
  const merged: OverlayBuilding[] = gameBuildings.map((game) => {
    const existing = byId.get(game.id);
    byId.delete(game.id);
    return {
      building_id: game.id,
      osm_id: existing?.osm_id,
      name: existing?.name ?? game.name,
      lat: existing?.lat ?? game.lat,
      lng: existing?.lng ?? game.lng,
      isShootTarget: existing?.isShootTarget ?? false,
      pendingGameId: false,
      faces: existing?.faces ?? []
    };
  });

  for (const leftover of byId.values()) {
    merged.push({ ...leftover, pendingGameId: leftover.pendingGameId ?? true });
  }

  return { schemaVersion: 1, buildings: merged };
}

export function buildingMapStatus(building: OverlayBuilding): 'idle' | 'target' | 'raw' | 'exported' {
  if (building.faces.some((face) => face.status === 'exported')) {
    return 'exported';
  }
  if (building.faces.some((face) => face.status === 'raw' || face.status === 'processed')) {
    return 'raw';
  }
  if (building.isShootTarget) {
    return 'target';
  }
  return 'idle';
}

export function defaultUvAdjust() {
  return { offsetX: 0, offsetY: 0, rotationDeg: 0, scale: 1, flipX: false, flipY: false };
}

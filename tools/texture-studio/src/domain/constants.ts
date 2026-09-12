export const MAP_CENTER = { lat: 38.9899314, lng: 141.1152492 };
export const MAP_ZOOM = 16;
export const MAP_BOUNDS = {
  southWest: { lat: 38.983, lng: 141.108 },
  northEast: { lat: 38.996, lng: 141.125 }
};

export const PATHS = {
  project: 'project.json',
  overlay: 'catalog/buildings.overlay.json',
  gameSnapshot: 'catalog/buildings.game.json',
  blenderFaces: 'blender/faces.json',
  rawDir: 'photos/raw',
  workDir: 'photos/work',
  exportDir: 'photos/export'
} as const;

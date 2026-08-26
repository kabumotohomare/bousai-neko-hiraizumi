export function latLngToWorldPosition(
  lat: number,
  lng: number,
  origin: { lat: number; lng: number }
): { x: number; z: number } {
  const metersPerLat = 111320;
  const metersPerLng = 111320 * Math.cos((origin.lat * Math.PI) / 180);

  const x = (lng - origin.lng) * metersPerLng;
  const z = -1 * (lat - origin.lat) * metersPerLat;

  return { x, z };
}

export function distance2d(a: { x: number; z: number }, b: { x: number; z: number }): number {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

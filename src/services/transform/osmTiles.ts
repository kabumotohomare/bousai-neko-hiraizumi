export function osmTileToLng(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

export function osmTileToLat(y: number, zoom: number): number {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** zoom;
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

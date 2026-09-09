import {
  ROAD_HIGHWAY_TYPES,
  ROAD_WIDTH_BY_HIGHWAY,
  type Road,
  type RoadHighway,
  RoadsSchema
} from '../../domain/road/model.ts';
import { latLngToWorldPosition, worldPositionToLatLng } from './latLngToWorldPosition.ts';

const HIGHWAY_SET = new Set<string>(ROAD_HIGHWAY_TYPES);
const SIMPLIFY_EPSILON_M = 0.8;
const MIN_POINT_GAP_M = 0.05;

interface OsmNode {
  lat: number;
  lng: number;
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRe = /([:\w]+)="([^"]*)"/g;
  let match: RegExpExecArray | null = attrRe.exec(tag);
  while (match) {
    attrs[match[1]] = match[2];
    match = attrRe.exec(tag);
  }
  return attrs;
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function perpendicularDistance(
  point: { x: number; z: number },
  start: { x: number; z: number },
  end: { x: number; z: number }
): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) {
    return Math.hypot(point.x - start.x, point.z - start.z);
  }
  return Math.abs(dz * point.x - dx * point.z + end.x * start.z - end.z * start.x) / length;
}

function simplifyWorldPoints(
  points: { x: number; z: number }[],
  epsilon: number
): { x: number; z: number }[] {
  if (points.length <= 2) {
    return points;
  }

  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i += 1) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  if (maxDistance <= epsilon) {
    return [start, end];
  }

  const left = simplifyWorldPoints(points.slice(0, maxIndex + 1), epsilon);
  const right = simplifyWorldPoints(points.slice(maxIndex), epsilon);
  return [...left.slice(0, -1), ...right];
}

function dedupeWorldPoints(points: { x: number; z: number }[]): { x: number; z: number }[] {
  const result: { x: number; z: number }[] = [];
  for (const point of points) {
    const previous = result[result.length - 1];
    if (!previous || Math.hypot(point.x - previous.x, point.z - previous.z) >= MIN_POINT_GAP_M) {
      result.push(point);
    }
  }
  return result;
}

function parseNodes(xml: string): Map<string, OsmNode> {
  const nodes = new Map<string, OsmNode>();
  const nodeRe = /<node\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null = nodeRe.exec(xml);
  while (match) {
    const attrs = parseAttributes(match[1]);
    const id = attrs.id;
    const lat = Number(attrs.lat);
    const lng = Number(attrs.lon);
    if (id && Number.isFinite(lat) && Number.isFinite(lng)) {
      nodes.set(id, { lat, lng });
    }
    match = nodeRe.exec(xml);
  }
  return nodes;
}

function parseWayTags(wayXml: string): { highway?: string; name?: string; area?: string } {
  const tags: { highway?: string; name?: string; area?: string } = {};
  const tagRe = /<tag\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null = tagRe.exec(wayXml);
  while (match) {
    const attrs = parseAttributes(match[1]);
    if (attrs.k === 'highway') {
      tags.highway = attrs.v;
    } else if (attrs.k === 'name') {
      tags.name = decodeXml(attrs.v);
    } else if (attrs.k === 'area') {
      tags.area = attrs.v;
    }
    match = tagRe.exec(wayXml);
  }
  return tags;
}

function parseWayNodeRefs(wayXml: string): string[] {
  const refs: string[] = [];
  const ndRe = /<nd\b([^>]*)\/?>/g;
  let match: RegExpExecArray | null = ndRe.exec(wayXml);
  while (match) {
    const attrs = parseAttributes(match[1]);
    if (attrs.ref) {
      refs.push(attrs.ref);
    }
    match = ndRe.exec(wayXml);
  }
  return refs;
}

function toSimplifiedPath(
  nodes: OsmNode[],
  origin: { lat: number; lng: number }
): { lat: number; lng: number }[] {
  const world = dedupeWorldPoints(
    nodes.map((node) => latLngToWorldPosition(node.lat, node.lng, origin))
  );
  const simplified = simplifyWorldPoints(world, SIMPLIFY_EPSILON_M);
  return simplified.map((point) => worldPositionToLatLng(point.x, point.z, origin));
}

export function toRoadsFromOsmXml(
  xml: string,
  origin: { lat: number; lng: number }
): Road[] {
  const nodes = parseNodes(xml);
  const roads: Road[] = [];
  const wayRe = /<way\b([^>]*)>([\s\S]*?)<\/way>/g;

  for (const match of xml.matchAll(wayRe)) {
    const attrs = parseAttributes(match[1]);
    const body = match[2];
    const tags = parseWayTags(body);
    const highway = tags.highway;

    if (!attrs.id || !highway || !HIGHWAY_SET.has(highway) || tags.area === 'yes') {
      continue;
    }

    const pathNodes: OsmNode[] = [];
    let missing = false;
    for (const ref of parseWayNodeRefs(body)) {
      const node = nodes.get(ref);
      if (!node) {
        missing = true;
        break;
      }
      pathNodes.push(node);
    }

    if (missing) {
      continue;
    }

    const path = toSimplifiedPath(pathNodes, origin);
    if (path.length < 2) {
      continue;
    }

    const typedHighway = highway as RoadHighway;
    const road: Road = {
      id: `road_${attrs.id}`,
      sourceId: attrs.id,
      highway: typedHighway,
      width: ROAD_WIDTH_BY_HIGHWAY[typedHighway],
      path
    };
    if (tags.name) {
      road.name = tags.name;
    }
    roads.push(road);
  }

  return RoadsSchema.parse(roads);
}

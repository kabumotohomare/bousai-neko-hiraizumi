import { MutableRefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Building } from '../../domain/building/model';
import { Cat } from '../../domain/cat/model';
import { resolveTerritoryMove } from '../../domain/cat/territory';
import { GameConfig } from '../../domain/common/config';
import {
  circleCollider,
  Collider,
  meshCollider,
  obbColliderFromFootprint,
  obbColliderFromPoints,
  resolveObstacleMove,
  Vec2
} from '../../domain/collision/obstacle';
import { findInspectableHydrantId } from '../../domain/hydrant/inspect';
import { Hydrant } from '../../domain/hydrant/model';
import { Road } from '../../domain/road/model';
import {
  headingDegToRotationY,
  latLngToWorldPosition
} from '../../services/transform/latLngToWorldPosition';
import { toRoadRibbon } from '../../services/transform/toRoadRibbon';
import { toTownModelTransform } from '../../services/transform/townModelPlacement';
import { PlayerInput, PlayerPose, readPlayerAxes } from '../../domain/session/playerInput';
import { footprintOfMesh, placeObjectOnGround, worldXZPointsOfMesh } from './meshGeometry';

const CAMERA_HEIGHT_M = 0.45;
const CAMERA_FOV = 60;
const TURN_SPEED_RAD_PER_SEC = 2.4;
const DASH_TURN_MULTIPLIER = 1.4;
const MAX_MOVE_STEP_M = 0.2;
const INSPECTED_COLOR = '#16a34a';
const UNINSPECTED_COLOR = '#dc2626';
const SKY_COLOR = '#a9d0f5';
// 道路(0.025)・町モデル(0.02)・建物の底面(0)など地表付近の要素と十分に離し、
// 深度バッファの精度不足によるちらつき(Zファイティング)を避ける。
const GROUND_Y = -0.08;
const ROAD_Y = 0.025;
const CAMERA_NEAR_M = 0.2;
const CAMERA_FAR_MARGIN_M = 120;
const SIDEWALK_M = 1.8;
const GRASS_TILE_M = 8;
const BOB_CYCLE_PER_M = 1.8;
const BOB_AMPLITUDE_M = 0.03;
const BOB_EASE_PER_SEC = 10;
const PLAYER_COLLISION_RADIUS_M = 0.35;
const HYDRANT_COLLISION_RADIUS_M = 0.35;
const DEFAULT_BUILDING_WIDTH_M = 8;
const DEFAULT_BUILDING_DEPTH_M = 8;
const DEFAULT_BUILDING_HEIGHT_M = 6;
const MAX_TOWN_BUILDING_SPAN_M = 60;
// 一度点検対象として選ばれた消火栓は、この分だけ半径を広げて「維持」する。
// タッチ操作でボタンを押そうとしている間にわずかに動いただけで選択が外れ、
// 気づかず通り過ぎてしまう体験（H7）を緩和するための猶予。
const INSPECT_EXIT_MARGIN_M = 0.6;

interface PatrolSceneProps {
  cat: Cat;
  hydrants: Hydrant[];
  buildings: Building[];
  roads: Road[];
  origin: { lat: number; lng: number };
  mapBounds: GameConfig['mapBounds'];
  moveSpeedMps: number;
  dashSpeedMps: number;
  inspectRadiusMeters: number;
  inspectedHydrantIds: string[];
  paused: boolean;
  inputRef: MutableRefObject<PlayerInput>;
  onInspectableChange: (hydrantId: string | null) => void;
  onPlayerPose: (pose: PlayerPose) => void;
  onBoundary: () => void;
  onObstacleHit: () => void;
  onFatalError: (cause?: unknown) => void;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh || child instanceof THREE.Line)) {
      return;
    }

    child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      material.dispose();
    }
  });
}

function placeTownModel(root: THREE.Object3D, origin: { lat: number; lng: number }): void {
  root.updateMatrixWorld(true);

  const mapnikBoxes: { minX: number; maxX: number; minZ: number; maxZ: number }[] = [];
  root.traverse((child) => {
    if (!child.name.includes('MAPNIK') || !(child instanceof THREE.Mesh)) {
      return;
    }
    const box = new THREE.Box3().setFromObject(child);
    mapnikBoxes.push({
      minX: box.min.x,
      maxX: box.max.x,
      minZ: box.min.z,
      maxZ: box.max.z
    });
    child.visible = false;
  });

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.visible) {
      return;
    }

    const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
    const lamberts = sourceMaterials.map((material) => {
      const map = 'map' in material ? material.map : null;
      if (map) {
        map.colorSpace = THREE.SRGBColorSpace;
      }
      const color = 'color' in material && material.color instanceof THREE.Color ? material.color : new THREE.Color('#c9c2b6');
      const lambert = new THREE.MeshLambertMaterial({ map, color });
      material.dispose();
      return lambert;
    });
    child.material = lamberts.length === 1 ? lamberts[0] : lamberts;
  });

  const mapnikBox = mapnikBoxes[0];
  if (mapnikBox) {
    const transform = toTownModelTransform(mapnikBox, origin);
    root.scale.set(transform.scaleX, 1, transform.scaleZ);
    root.position.set(transform.x, 0.02, transform.z);
  } else {
    root.position.set(0, 0.02, 0);
  }

  // scale/position を変更しただけでは matrixWorld に反映されない。
  // Box3.setFromObject(child) は親の matrixWorld を更新しない（updateParents: false）ため、
  // ここで確定させておかないと、呼び出し側で子メッシュの当たり判定AABBが
  // 配置前の生の座標のままズレて計算されてしまう。
  root.updateMatrixWorld(true);
}

// 町全体の背景モデルは1個の巨大な箱としては扱わない（丸ごと当たり判定にすると遊べなくなる）。
// その代わり、含まれる建物メッシュ単位（MAPNIKの地図タイルは除く）で当たり判定を作る。
// 建物メッシュの接地面の三角形をそのまま当たり判定に使う（meshCollider）。
// 単一の外接矩形(OBB)だと、道路に対して斜めに配置された建物や、L字などの
// 非凸な実際の建物形状に対して「形状全体を覆う矩形」になってしまい、
// 本来は建物の外(凹んだ部分や隣の空き地)であるはずの場所まで塞いでしまう
// （＝実機で報告された「何もない場所で見えない壁にぶつかる」不具合の原因）。
// 地面や道路のような極端に大きいメッシュは誤検出を避けるため除外する。
function collectTownBuildingColliders(
  root: THREE.Object3D,
  isRelevant: (center: { x: number; z: number }) => boolean
): Collider[] {
  const colliders: Collider[] = [];
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || !child.visible) {
      return;
    }

    const box = new THREE.Box3().setFromObject(child);
    const width = box.max.x - box.min.x;
    const depth = box.max.z - box.min.z;
    if (width <= 0 || depth <= 0 || width > MAX_TOWN_BUILDING_SPAN_M || depth > MAX_TOWN_BUILDING_SPAN_M) {
      return;
    }

    const center = { x: (box.min.x + box.max.x) / 2, z: (box.min.z + box.max.z) / 2 };
    if (!isRelevant(center)) {
      return;
    }

    // メッシュの三角形をそのまま当たり判定に使う。単一のOBB(外接矩形)だと、
    // 非凸(L字など)な実際の建物形状に対して形状全体を覆う矩形になってしまい、
    // 本来は建物の外(凹んだ部分)であるはずの場所まで塞いでしまう(見えない壁)。
    const footprint = footprintOfMesh(child);
    if (footprint.triangles.length === 0) {
      return;
    }

    colliders.push(meshCollider(footprint.triangles, footprint.edges));
  });
  return colliders;
}

function createTerritoryRing(radius: number, color: string): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(radius - 0.7, radius * 0.97), radius + 0.7, 96),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7,
      // 半透明なので深度バッファへの書き込みは不要。書き込んだままだと、
      // 道路(0.025)とわずか1.5cmしか離れていないのと相まって、境界付近で
      // 移動中にちらつく(Zファイティング)原因になりうる。
      depthWrite: false
    })
  );
  ring.rotation.x = -Math.PI / 2;
  // 道路(0.025)から離してZファイティングを避ける。
  ring.position.y = 0.07;
  return ring;
}

function createHydrantMarker(inspected: boolean): THREE.Mesh {
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.24, 1.1, 8),
    new THREE.MeshLambertMaterial({ color: inspected ? INSPECTED_COLOR : UNINSPECTED_COLOR })
  );
  marker.position.y = 0.55;
  return marker;
}

function resolveBuildingFootprint(building: Building): { width: number; depth: number; height: number } {
  return {
    width: building.width ?? DEFAULT_BUILDING_WIDTH_M,
    depth: building.depth ?? DEFAULT_BUILDING_DEPTH_M,
    height: building.height ?? DEFAULT_BUILDING_HEIGHT_M
  };
}

function createGenericBuilding(building: Building, x: number, z: number): THREE.Mesh {
  const { width, depth, height } = resolveBuildingFootprint(building);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshLambertMaterial({ color: '#c4b8a0' })
  );
  mesh.position.set(x, height / 2, z);
  mesh.rotation.y = headingDegToRotationY(building.headingDeg);
  return mesh;
}

function loadGltf(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function createGrassTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('地面テクスチャを生成できませんでした。');
  }

  // 平泉の路地写真（雑草・裸地の混じった緑）を参考にした配色。彩度は写真より落として統一感を出す。
  ctx.fillStyle = '#7c9560';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 420; i += 1) {
    const roll = i % 5;
    ctx.fillStyle = roll === 0 ? '#8a7454' : roll <= 2 ? '#6c8449' : '#93aa6c';
    ctx.fillRect(Math.random() * size, Math.random() * size, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createRoadTexture(): THREE.CanvasTexture {
  const width = 64;
  const height = 128;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('道路テクスチャを生成できませんでした。');
  }

  // 平泉の路地写真を参考に、歩道は赤茶系レンガ舗装、車道は青みを抑えた落ち着いたアスファルトへ。
  const sidewalk = '#ad8264';
  const paver = '#96694c';
  const asphalt = '#48473f';
  const asphaltGrain = '#3a3933';
  const line = '#e8e2d2';

  ctx.fillStyle = sidewalk;
  ctx.fillRect(0, 0, width, height);
  for (let x = 0; x < width; x += 8) {
    ctx.fillStyle = paver;
    ctx.fillRect(x, 0, 1, height);
  }
  for (let y = 0; y < height; y += 10) {
    ctx.fillStyle = paver;
    ctx.fillRect(0, y, width, 1);
  }

  ctx.fillStyle = asphalt;
  ctx.fillRect(14, 0, 36, height);
  for (let i = 0; i < 180; i += 1) {
    ctx.fillStyle = asphaltGrain;
    ctx.fillRect(14 + Math.random() * 36, Math.random() * height, 1, 1);
  }

  // 中央の破線（車線区切り）は入れない。運転している印象を避け、あくまで猫が歩く路地に留める。
  ctx.fillStyle = line;
  ctx.fillRect(14, 0, 2, height);
  ctx.fillRect(48, 0, 2, height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createRoadMesh(roads: Road[], origin: { lat: number; lng: number }, texture: THREE.Texture): THREE.Mesh | null {
  const geometries: THREE.BufferGeometry[] = [];

  roads.forEach((road, index) => {
    const worldPath = road.path.map((point) => latLngToWorldPosition(point.lat, point.lng, origin));
    // 交差点では別々の道路のリボンが同じ高さで重なり、移動中にちらつく(Zファイティング)。
    // 道路ごとにごくわずかに高さをずらし(見た目には分からない差)、重なりを解消する。
    const roadY = ROAD_Y + (index % 5) * 0.002;
    const ribbon = toRoadRibbon(worldPath, road.width + SIDEWALK_M * 2, roadY);
    if (ribbon.indices.length === 0) {
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(ribbon.positions, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(ribbon.uvs, 2));
    geometry.setIndex(ribbon.indices);
    geometries.push(geometry);
  });

  if (geometries.length === 0) {
    return null;
  }

  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) {
    geometry.dispose();
  }
  if (!merged) {
    return null;
  }

  merged.computeVertexNormals();
  const material = new THREE.MeshLambertMaterial({ map: texture });
  // 地面とほぼ同じ高さのため、移動中に深度バッファの精度不足でちらつく(Zファイティング)ことがある。
  // ポリゴンオフセットで道路を確実に手前に描かせる。
  material.polygonOffset = true;
  material.polygonOffsetFactor = -4;
  material.polygonOffsetUnits = -4;
  return new THREE.Mesh(merged, material);
}

function applyCamera(
  camera: THREE.PerspectiveCamera,
  x: number,
  z: number,
  heading: number,
  bobY = 0
): void {
  camera.position.set(x, CAMERA_HEIGHT_M + bobY, z);
  // lookAt のあと rotation.z を消すと、南向きなどで Euler がひっくり返り上下が逆になる。
  camera.rotation.order = 'YXZ';
  camera.rotation.set(0, -heading, 0);
}

export function PatrolScene({
  cat,
  hydrants,
  buildings,
  roads,
  origin,
  mapBounds,
  moveSpeedMps,
  dashSpeedMps,
  inspectRadiusMeters,
  inspectedHydrantIds,
  paused,
  inputRef,
  onInspectableChange,
  onPlayerPose,
  onBoundary,
  onObstacleHit,
  onFatalError
}: PatrolSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hydrantMeshesRef = useRef(new Map<string, THREE.MeshLambertMaterial>());
  const inspectedRef = useRef(inspectedHydrantIds);
  const onPlayerPoseRef = useRef(onPlayerPose);
  const pausedRef = useRef(paused);
  const dashSpeedRef = useRef(dashSpeedMps);

  useEffect(() => {
    onPlayerPoseRef.current = onPlayerPose;
  }, [onPlayerPose]);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    dashSpeedRef.current = dashSpeedMps;
  }, [dashSpeedMps]);

  useEffect(() => {
    inspectedRef.current = inspectedHydrantIds;
    hydrantMeshesRef.current.forEach((material, id) => {
      material.color.set(inspectedHydrantIds.includes(id) ? INSPECTED_COLOR : UNINSPECTED_COLOR);
    });
  }, [inspectedHydrantIds]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    let lastInspectable: string | null | undefined;
    const disposable = new Set<THREE.Object3D>();
    const hydrantMaterials = hydrantMeshesRef.current;
    hydrantMaterials.clear();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(SKY_COLOR);
    scene.fog = new THREE.Fog(SKY_COLOR, cat.radius * 0.8, cat.radius + 80);

    // near/far の比が大きすぎると深度バッファの精度が落ち、移動中にちらつきやすくなるため、
    // 実際にフォグで見える範囲(cat.radius + 80)に合わせて far を絞る。
    const camera = new THREE.PerspectiveCamera(
      CAMERA_FOV,
      1,
      CAMERA_NEAR_M,
      cat.radius + CAMERA_FAR_MARGIN_M
    );
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#e7f3ff', '#6e7d5c', 1.2);
    const sun = new THREE.DirectionalLight('#fff6e4', 0.7);
    sun.position.set(40, 60, 20);
    scene.add(hemi, sun);

    const catWorld = latLngToWorldPosition(cat.center.lat, cat.center.lng, origin);
    const spawn = latLngToWorldPosition(cat.spawn.lat, cat.spawn.lng, origin);
    const southWest = latLngToWorldPosition(mapBounds.southWest.lat, mapBounds.southWest.lng, origin);
    const northEast = latLngToWorldPosition(mapBounds.northEast.lat, mapBounds.northEast.lng, origin);
    const groundWidth = Math.max(Math.abs(northEast.x - southWest.x), cat.radius * 2 + 16);
    const groundDepth = Math.max(Math.abs(northEast.z - southWest.z), cat.radius * 2 + 16);
    const grassTexture = createGrassTexture();
    grassTexture.repeat.set(groundWidth / GRASS_TILE_M, groundDepth / GRASS_TILE_M);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundWidth, groundDepth, 8, 8),
      new THREE.MeshLambertMaterial({ map: grassTexture })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((southWest.x + northEast.x) / 2, GROUND_Y, (southWest.z + northEast.z) / 2);
    scene.add(ground);
    disposable.add(ground);

    const roadTexture = createRoadTexture();
    const roadMesh = createRoadMesh(roads, origin, roadTexture);
    if (roadMesh) {
      scene.add(roadMesh);
      disposable.add(roadMesh);
    }

    const ring = createTerritoryRing(cat.radius, cat.territoryColor);
    ring.position.set(catWorld.x, ring.position.y, catWorld.z);
    scene.add(ring);
    disposable.add(ring);

    const hydrantPoints = hydrants.map((hydrant) => {
      const pos = latLngToWorldPosition(hydrant.lat, hydrant.lng, origin);
      const marker = createHydrantMarker(inspectedRef.current.includes(hydrant.id));
      marker.position.set(pos.x, marker.position.y, pos.z);
      scene.add(marker);
      disposable.add(marker);
      hydrantMaterials.set(hydrant.id, marker.material as THREE.MeshLambertMaterial);
      return { id: hydrant.id, position: pos };
    });

    // 建物・消火栓の当たり判定。重い物理エンジンは使わず、AABB/円と点(猫)の軽量判定のみ行う。
    const colliders: Collider[] = hydrantPoints.map(({ position }) =>
      circleCollider(position, HYDRANT_COLLISION_RADIUS_M)
    );

    const inPlayRadiusWorld = (pos: { x: number; z: number }): boolean => {
      const dx = pos.x - catWorld.x;
      const dz = pos.z - catWorld.z;
      return Math.hypot(dx, dz) <= cat.radius + 30;
    };

    const inPlayRadius = (lat: number, lng: number): boolean =>
      inPlayRadiusWorld(latLngToWorldPosition(lat, lng, origin));

    for (const building of buildings) {
      if (building.kind !== 'generic' || !inPlayRadius(building.lat, building.lng)) {
        continue;
      }

      const pos = latLngToWorldPosition(building.lat, building.lng, origin);
      const box = createGenericBuilding(building, pos.x, pos.z);
      scene.add(box);
      disposable.add(box);

      const { width, depth } = resolveBuildingFootprint(building);
      colliders.push(obbColliderFromFootprint(pos, width, depth, headingDegToRotationY(building.headingDeg)));
    }

    const landmarks = buildings.filter((building) => {
      if (building.kind !== 'landmark' || !building.modelUrl) {
        return false;
      }
      if (building.placement === 'town') {
        return true;
      }
      return inPlayRadius(building.lat, building.lng);
    });

    const player = { x: spawn.x, z: spawn.z, heading: 0 };
    if (hydrantPoints.length > 0) {
      const nearest = hydrantPoints.reduce((best, hydrant) => {
        const bestDist = Math.hypot(best.position.x - spawn.x, best.position.z - spawn.z);
        const nextDist = Math.hypot(hydrant.position.x - spawn.x, hydrant.position.z - spawn.z);
        return nextDist < bestDist ? hydrant : best;
      });
      player.heading = Math.atan2(nearest.position.x - spawn.x, -(nearest.position.z - spawn.z));
    }
    applyCamera(camera, player.x, player.z, player.heading);
    onPlayerPoseRef.current({ x: player.x, z: player.z, heading: player.heading });

    const resize = () => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) {
        return;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(container);

    const clock = new THREE.Clock();
    let lastPoseAt = 0;
    let walkPhase = 0;
    let bobAmount = 0;
    const tick = () => {
      if (cancelled) {
        return;
      }

      // clock は一時停止中も進めておく（再開時に停止時間分の dt が一気に来て猫が飛ぶのを防ぐ）。
      const dt = Math.min(clock.getDelta(), 0.05);

      if (!pausedRef.current) {
        const axes = readPlayerAxes(inputRef.current);
        const dashing = inputRef.current.dash;
        const speed = dashing ? dashSpeedRef.current : moveSpeedMps;
        const turnSpeed = TURN_SPEED_RAD_PER_SEC * (dashing ? DASH_TURN_MULTIPLIER : 1);
        player.heading += axes.turn * turnSpeed * dt;

        const distance = axes.forward * speed * dt;
        let remaining = distance;
        let collided = false;
        let bounced = false;
        while (Math.abs(remaining) > 1e-9) {
          const stepAbs = Math.min(Math.abs(remaining), MAX_MOVE_STEP_M);
          const step = Math.sign(remaining) * stepAbs;
          remaining -= step;
          const previous = { x: player.x, z: player.z };
          const attempted = {
            x: player.x + Math.sin(player.heading) * step,
            z: player.z - Math.cos(player.heading) * step
          };
          const obstacleResolved = resolveObstacleMove(
            previous,
            attempted,
            colliders,
            PLAYER_COLLISION_RADIUS_M
          );
          const resolved = resolveTerritoryMove(previous, obstacleResolved.position, catWorld, cat.radius);
          player.x = resolved.position.x;
          player.z = resolved.position.z;
          collided = collided || obstacleResolved.collided;
          bounced = bounced || resolved.bounced;
          if (
            obstacleResolved.collided &&
            resolved.position.x === previous.x &&
            resolved.position.z === previous.z
          ) {
            break;
          }
        }
        if (bounced) {
          onBoundary();
        }
        if (collided) {
          onObstacleHit();
        }

        // 猫が歩いている手触りを出すための軽い上下動。車のような滑走感を避ける。
        const moving = Math.abs(distance) > 0.0001;
        if (moving) {
          walkPhase += Math.abs(distance) * BOB_CYCLE_PER_M * Math.PI * 2;
        }
        const bobAmp = dashing ? BOB_AMPLITUDE_M * 0.5 : BOB_AMPLITUDE_M;
        const targetBob = moving ? Math.abs(Math.sin(walkPhase)) * bobAmp : 0;
        bobAmount += (targetBob - bobAmount) * Math.min(1, BOB_EASE_PER_SEC * dt);

        applyCamera(camera, player.x, player.z, player.heading, bobAmount);

        const now = performance.now();
        if (now - lastPoseAt > 100) {
          lastPoseAt = now;
          onPlayerPoseRef.current({ x: player.x, z: player.z, heading: player.heading });
        }

        const inspectable = findInspectableHydrantId(
          { x: player.x, z: player.z },
          hydrantPoints,
          inspectedRef.current,
          inspectRadiusMeters,
          { previousInspectableId: lastInspectable, exitRadiusMeters: inspectRadiusMeters + INSPECT_EXIT_MARGIN_M }
        );
        if (inspectable !== lastInspectable) {
          lastInspectable = inspectable;
          onInspectableChange(inspectable);
        }

        renderer.render(scene, camera);
      }

      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);

    const loadLandmarks = async () => {
      try {
        await Promise.all(
          landmarks.map(async (building) => {
            const url = building.modelUrl;
            if (!url) {
              return;
            }

            const model = await loadGltf(url);
            if (cancelled) {
              disposeObject(model);
              return;
            }

            if (building.placement === 'town') {
              placeTownModel(model, origin);
              colliders.push(...collectTownBuildingColliders(model, inPlayRadiusWorld));
            } else {
              const pos = latLngToWorldPosition(building.lat, building.lng, origin);
              model.rotation.y = headingDegToRotationY(building.headingDeg);
              placeObjectOnGround(model, pos.x, pos.z);
              // placeObjectOnGround は最後に position を set するだけで matrixWorld
              // には反映されない（placeTownModel と同じ理由。139行目のコメント参照）。
              // ここで確定させないと、直後に読む child.matrixWorld が「配置前」の
              // 姿勢のままになり、当たり判定(OBB)が実際の建物モデルの位置から
              // 大きくズレる（＝原点付近など見当違いの場所に見えない壁ができる）。
              model.updateMatrixWorld(true);

              const points: Vec2[] = [];
              model.traverse((child) => {
                if (child instanceof THREE.Mesh && child.visible) {
                  points.push(...worldXZPointsOfMesh(child));
                }
              });
              if (points.length >= 3) {
                colliders.push(obbColliderFromPoints(points));
              }
            }
            scene.add(model);
            disposable.add(model);
          })
        );

        if (!cancelled) {
          container.dataset.ready = 'true';
        }
      } catch (error) {
        if (!cancelled) {
          onFatalError(error);
        }
      }
    };

    if (landmarks.length === 0) {
      container.dataset.ready = 'true';
    } else {
      void loadLandmarks();
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      delete container.dataset.ready;
      hydrantMaterials.clear();

      for (const object of disposable) {
        scene.remove(object);
        disposeObject(object);
      }

      grassTexture.dispose();
      roadTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    buildings,
    cat,
    hydrants,
    roads,
    inputRef,
    inspectRadiusMeters,
    mapBounds,
    moveSpeedMps,
    onBoundary,
    onObstacleHit,
    onFatalError,
    onInspectableChange,
    origin
  ]);

  return <div ref={containerRef} className="scene-canvas" aria-label="みまわり空間" />;
}

import { MutableRefObject, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Building } from '../../domain/building/model';
import { Cat } from '../../domain/cat/model';
import { resolveTerritoryMove } from '../../domain/cat/territory';
import { GameConfig } from '../../domain/common/config';
import { findInspectableHydrantId } from '../../domain/hydrant/inspect';
import { Hydrant } from '../../domain/hydrant/model';
import {
  headingDegToRotationY,
  latLngToWorldPosition
} from '../../services/transform/latLngToWorldPosition';
import { PlayerInput, PlayerPose, readPlayerAxes } from '../../domain/session/playerInput';

const CAMERA_HEIGHT_M = 0.45;
const CAMERA_FOV = 60;
const TURN_SPEED_RAD_PER_SEC = 2.4;
const INSPECTED_COLOR = '#16a34a';
const UNINSPECTED_COLOR = '#dc2626';

interface PatrolSceneProps {
  cat: Cat;
  hydrants: Hydrant[];
  buildings: Building[];
  origin: { lat: number; lng: number };
  mapBounds: GameConfig['mapBounds'];
  moveSpeedMps: number;
  inspectRadiusMeters: number;
  inspectedHydrantIds: string[];
  inputRef: MutableRefObject<PlayerInput>;
  onInspectableChange: (hydrantId: string | null) => void;
  onPlayerPose: (pose: PlayerPose) => void;
  onBoundary: () => void;
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

function placeObjectOnGround(root: THREE.Object3D, x: number, z: number): void {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());

  if (size.y > 0 && (size.y < 2 || size.y > 25)) {
    root.scale.multiplyScalar(10 / size.y);
  }

  const fitted = new THREE.Box3().setFromObject(root);
  const center = fitted.getCenter(new THREE.Vector3());
  root.position.set(x - (center.x - root.position.x), root.position.y - fitted.min.y, z - (center.z - root.position.z));
}

function createTerritoryRing(radius: number, color: string): THREE.Mesh {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(Math.max(radius - 0.7, radius * 0.97), radius + 0.7, 96),
    new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
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

function createGenericBuilding(building: Building, x: number, z: number): THREE.Mesh {
  const width = building.width ?? 8;
  const depth = building.depth ?? 8;
  const height = building.height ?? 6;
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

function applyCamera(camera: THREE.PerspectiveCamera, x: number, z: number, heading: number): void {
  camera.position.set(x, CAMERA_HEIGHT_M, z);
  // lookAt のあと rotation.z を消すと、南向きなどで Euler がひっくり返り上下が逆になる。
  camera.rotation.order = 'YXZ';
  camera.rotation.set(0, -heading, 0);
}

export function PatrolScene({
  cat,
  hydrants,
  buildings,
  origin,
  mapBounds,
  moveSpeedMps,
  inspectRadiusMeters,
  inspectedHydrantIds,
  inputRef,
  onInspectableChange,
  onPlayerPose,
  onBoundary,
  onFatalError
}: PatrolSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hydrantMeshesRef = useRef(new Map<string, THREE.MeshLambertMaterial>());
  const inspectedRef = useRef(inspectedHydrantIds);
  const onPlayerPoseRef = useRef(onPlayerPose);

  useEffect(() => {
    onPlayerPoseRef.current = onPlayerPose;
  }, [onPlayerPose]);

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
    scene.background = new THREE.Color('#b9d4ea');

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 800);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#e8f2ff', '#8f9a6e', 1.15);
    const sun = new THREE.DirectionalLight('#fff4d6', 0.55);
    sun.position.set(40, 60, 20);
    scene.add(hemi, sun);

    const catWorld = latLngToWorldPosition(cat.center.lat, cat.center.lng, origin);
    const spawn = latLngToWorldPosition(cat.spawn.lat, cat.spawn.lng, origin);
    const southWest = latLngToWorldPosition(mapBounds.southWest.lat, mapBounds.southWest.lng, origin);
    const northEast = latLngToWorldPosition(mapBounds.northEast.lat, mapBounds.northEast.lng, origin);
    const groundWidth = Math.max(Math.abs(northEast.x - southWest.x), cat.radius * 2 + 16);
    const groundDepth = Math.max(Math.abs(northEast.z - southWest.z), cat.radius * 2 + 16);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundWidth, groundDepth),
      new THREE.MeshLambertMaterial({ color: '#c5cc9c' })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set((southWest.x + northEast.x) / 2, 0, (southWest.z + northEast.z) / 2);
    scene.add(ground);
    disposable.add(ground);

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

    const inPlayRadius = (lat: number, lng: number): boolean => {
      const pos = latLngToWorldPosition(lat, lng, origin);
      const dx = pos.x - catWorld.x;
      const dz = pos.z - catWorld.z;
      return Math.hypot(dx, dz) <= cat.radius + 30;
    };

    for (const building of buildings) {
      if (building.kind !== 'generic' || !inPlayRadius(building.lat, building.lng)) {
        continue;
      }

      const pos = latLngToWorldPosition(building.lat, building.lng, origin);
      const box = createGenericBuilding(building, pos.x, pos.z);
      scene.add(box);
      disposable.add(box);
    }

    const landmarks = buildings.filter(
      (building) => building.kind === 'landmark' && building.modelUrl && inPlayRadius(building.lat, building.lng)
    );

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
    const tick = () => {
      if (cancelled) {
        return;
      }

      const dt = Math.min(clock.getDelta(), 0.05);
      const axes = readPlayerAxes(inputRef.current);
      player.heading += axes.turn * TURN_SPEED_RAD_PER_SEC * dt;

      const distance = axes.forward * moveSpeedMps * dt;
      const attempted = {
        x: player.x + Math.sin(player.heading) * distance,
        z: player.z - Math.cos(player.heading) * distance
      };
      const resolved = resolveTerritoryMove({ x: player.x, z: player.z }, attempted, catWorld, cat.radius);
      player.x = resolved.position.x;
      player.z = resolved.position.z;
      if (resolved.bounced) {
        onBoundary();
      }

      applyCamera(camera, player.x, player.z, player.heading);

      const now = performance.now();
      if (now - lastPoseAt > 100) {
        lastPoseAt = now;
        onPlayerPoseRef.current({ x: player.x, z: player.z, heading: player.heading });
      }

      const inspectable = findInspectableHydrantId(
        { x: player.x, z: player.z },
        hydrantPoints,
        inspectedRef.current,
        inspectRadiusMeters
      );
      if (inspectable !== lastInspectable) {
        lastInspectable = inspectable;
        onInspectableChange(inspectable);
      }

      renderer.render(scene, camera);
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

            const pos = latLngToWorldPosition(building.lat, building.lng, origin);
            model.rotation.y = headingDegToRotationY(building.headingDeg);
            placeObjectOnGround(model, pos.x, pos.z);
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

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [
    buildings,
    cat,
    hydrants,
    inputRef,
    inspectRadiusMeters,
    mapBounds,
    moveSpeedMps,
    onBoundary,
    onFatalError,
    onInspectableChange,
    origin
  ]);

  return <div ref={containerRef} className="scene-canvas" aria-label="みまわり空間" />;
}

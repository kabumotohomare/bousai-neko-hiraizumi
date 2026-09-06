import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Cat } from '../../domain/cat/model';
import { Hydrant } from '../../domain/hydrant/model';
import { latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';

const SAMPLE_BUILDING_URL = '/models/buildings/sample.glb';
const CAMERA_HEIGHT_M = 0.45;
const CAMERA_FOV = 60;
const CAMERA_BACK_M = 14;
const CAMERA_LOOK_HEIGHT_M = 2.4;

interface PatrolSceneProps {
  cat: Cat;
  hydrants: Hydrant[];
  origin: { lat: number; lng: number };
  inspectedHydrantIds: string[];
  onFatalError: (cause?: unknown) => void;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
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

  // cm 単位や巨大スケールの GLB を、建物らしい高さへ寄せる。
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
    new THREE.CylinderGeometry(0.18, 0.22, 0.8, 8),
    new THREE.MeshLambertMaterial({ color: inspected ? '#16a34a' : '#dc2626' })
  );
  marker.position.y = 0.4;
  return marker;
}

export function PatrolScene({
  cat,
  hydrants,
  origin,
  inspectedHydrantIds,
  onFatalError
}: PatrolSceneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let frameId = 0;
    const disposable = new Set<THREE.Object3D>();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#b9d4ea');

    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 400);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    const hemi = new THREE.HemisphereLight('#e8f2ff', '#8f9a6e', 1.15);
    const sun = new THREE.DirectionalLight('#fff4d6', 0.55);
    sun.position.set(40, 60, 20);
    scene.add(hemi, sun);

    const spawn = latLngToWorldPosition(cat.spawn.lat, cat.spawn.lng, origin);
    const building = latLngToWorldPosition(cat.center.lat, cat.center.lng, origin);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(cat.radius + 8, 64),
      new THREE.MeshLambertMaterial({ color: '#c5cc9c' })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(spawn.x, 0, spawn.z);
    scene.add(ground);
    disposable.add(ground);

    const ring = createTerritoryRing(cat.radius, cat.territoryColor);
    ring.position.set(spawn.x, ring.position.y, spawn.z);
    scene.add(ring);
    disposable.add(ring);

    for (const hydrant of hydrants) {
      const pos = latLngToWorldPosition(hydrant.lat, hydrant.lng, origin);
      const marker = createHydrantMarker(inspectedHydrantIds.includes(hydrant.id));
      marker.position.set(pos.x, marker.position.y, pos.z);
      scene.add(marker);
      disposable.add(marker);
    }

    // spawn と建物が同じ点だとモデルの中に入るので、南へ下がって正面を見る。
    camera.position.set(spawn.x, CAMERA_HEIGHT_M, spawn.z + CAMERA_BACK_M);
    camera.lookAt(building.x, CAMERA_LOOK_HEIGHT_M, building.z);
    camera.rotation.z = 0;

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

    const tick = () => {
      if (cancelled) {
        return;
      }
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(tick);
    };
    frameId = window.requestAnimationFrame(tick);

    const loader = new GLTFLoader();
    loader.load(
      SAMPLE_BUILDING_URL,
      (gltf) => {
        if (cancelled) {
          disposeObject(gltf.scene);
          return;
        }

        placeObjectOnGround(gltf.scene, building.x, building.z);
        scene.add(gltf.scene);
        disposable.add(gltf.scene);
        container.dataset.ready = 'true';
      },
      undefined,
      (error) => {
        if (!cancelled) {
          onFatalError(error);
        }
      }
    );

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
      delete container.dataset.ready;

      for (const object of disposable) {
        scene.remove(object);
        disposeObject(object);
      }

      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [cat, hydrants, inspectedHydrantIds, onFatalError, origin]);

  return <div ref={containerRef} className="scene-canvas" aria-label="みまわり空間" />;
}

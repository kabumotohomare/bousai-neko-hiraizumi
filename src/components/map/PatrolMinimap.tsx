import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Cat } from '../../domain/cat/model';
import { GameConfig } from '../../domain/common/config';
import { Hydrant } from '../../domain/hydrant/model';
import { PlayerPose } from '../../domain/session/playerInput';
import { worldPositionToLatLng } from '../../services/transform/latLngToWorldPosition';
import { clampMapToTown, toTownBounds } from './townBounds';

interface PatrolMinimapProps {
  cat: Cat;
  hydrants: Hydrant[];
  inspectedHydrantIds: string[];
  origin: { lat: number; lng: number };
  mapBounds: GameConfig['mapBounds'];
  pose: PlayerPose;
}

function createPlayerIcon(headingRad: number): L.DivIcon {
  const deg = (headingRad * 180) / Math.PI;
  return L.divIcon({
    className: 'minimap-player',
    html: `<span class="minimap-player__arrow" style="transform:rotate(${deg}deg)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
  });
}

export function PatrolMinimap({
  cat,
  hydrants,
  inspectedHydrantIds,
  origin,
  mapBounds,
  pose
}: PatrolMinimapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const playerRef = useRef<L.Marker | null>(null);
  const hydrantLayerRef = useRef(new Map<string, L.CircleMarker>());
  const [mapReady, setMapReady] = useState(false);
  const playerLatLng = worldPositionToLatLng(pose.x, pose.z, origin);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const townBounds = toTownBounds(mapBounds);
    const map = L.map(container, {
      center: [cat.center.lat, cat.center.lng],
      zoom: 17,
      zoomControl: false,
      attributionControl: true,
      dragging: false,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      maxBounds: townBounds,
      maxBoundsViscosity: 1.0,
      maxZoom: 19,
      scrollWheelZoom: false
    });
    map.attributionControl.setPrefix(false);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    const territory = L.circle([cat.center.lat, cat.center.lng], {
      radius: cat.radius,
      color: cat.territoryColor,
      fillColor: cat.territoryColor,
      weight: 2,
      opacity: 0.9,
      fillOpacity: 0.12
    }).addTo(map);

    map.fitBounds(territory.getBounds(), { padding: [10, 10] });
    clampMapToTown(map, townBounds);

    mapRef.current = map;
    setMapReady(true);

    const observer = new ResizeObserver(() => clampMapToTown(map, townBounds));
    observer.observe(container);

    const hydrantLayers = hydrantLayerRef.current;

    return () => {
      observer.disconnect();
      territory.remove();
      map.remove();
      mapRef.current = null;
      playerRef.current = null;
      hydrantLayers.clear();
      setMapReady(false);
    };
  }, [cat, mapBounds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const layers = hydrantLayerRef.current;
    layers.forEach((marker) => marker.remove());
    layers.clear();

    hydrants.forEach((hydrant) => {
      const inspected = inspectedHydrantIds.includes(hydrant.id);
      const marker = L.circleMarker([hydrant.lat, hydrant.lng], {
        radius: 4,
        color: inspected ? '#16a34a' : '#dc2626',
        fillColor: inspected ? '#16a34a' : '#dc2626',
        fillOpacity: 1,
        weight: 1
      }).addTo(map);
      layers.set(hydrant.id, marker);
    });

    return () => {
      layers.forEach((marker) => marker.remove());
      layers.clear();
    };
  }, [hydrants, inspectedHydrantIds, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) {
      return;
    }

    const latLng: L.LatLngExpression = [playerLatLng.lat, playerLatLng.lng];

    if (!playerRef.current) {
      playerRef.current = L.marker(latLng, {
        icon: createPlayerIcon(pose.heading),
        interactive: false,
        zIndexOffset: 600
      }).addTo(map);
      return;
    }

    playerRef.current.setLatLng(latLng);
    const arrow = playerRef.current.getElement()?.querySelector('.minimap-player__arrow');
    if (arrow instanceof HTMLElement) {
      arrow.style.transform = `rotate(${(pose.heading * 180) / Math.PI}deg)`;
    }
  }, [mapReady, playerLatLng.lat, playerLatLng.lng, pose.heading]);

  return (
    <div
      ref={containerRef}
      className="patrol-minimap"
      role="img"
      aria-label="いまいる場所の地図"
      data-player-lat={playerLatLng.lat.toFixed(6)}
      data-player-lng={playerLatLng.lng.toFixed(6)}
    />
  );
}

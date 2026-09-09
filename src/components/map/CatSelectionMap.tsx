import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Cat } from '../../domain/cat/model';
import { GameConfig } from '../../domain/common/config';
import { clampMapToTown, toTownBounds } from './townBounds';

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function createPinIcon(cat: Cat): L.DivIcon {
  const badge = cat.photoUrl
    ? `<img class="cat-pin__photo" src="${escapeHtml(cat.photoUrl)}" alt="" />`
    : `<span class="cat-pin__dot" style="background:${cat.territoryColor}"></span>`;

  return L.divIcon({
    className: 'cat-pin',
    html: `${badge}<span class="cat-pin__label">${escapeHtml(cat.name)}</span>`,
    iconSize: [120, 76],
    // 写真の中心が猫の座標に来るようにする。
    iconAnchor: [60, cat.photoUrl ? 26 : 11]
  });
}

function applyCircleStyle(circle: L.Circle, cat: Cat, selected: boolean): void {
  const color = cat.territoryColor;

  circle.setStyle({
    color,
    fillColor: color,
    weight: selected ? 3 : 2,
    opacity: selected ? 1 : 0.75,
    fillOpacity: selected ? 0.18 : 0.09,
    dashArray: selected ? undefined : '6 6'
  });
}

interface CatSelectionMapProps {
  cats: Cat[];
  selectedCatId: string | null;
  center: { lat: number; lng: number };
  zoom: number;
  mapBounds: GameConfig['mapBounds'];
  onSelectCat: (catId: string) => void;
}

export function CatSelectionMap({
  cats,
  selectedCatId,
  center,
  zoom,
  mapBounds,
  onSelectCat
}: CatSelectionMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef(new Map<string, { circle: L.Circle; marker: L.Marker }>());
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const townBounds = toTownBounds(mapBounds);
    const map = L.map(container, {
      center: [center.lat, center.lng],
      zoom,
      maxBounds: townBounds,
      maxBoundsViscosity: 1.0,
      maxZoom: 19
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    clampMapToTown(map, townBounds);

    mapRef.current = map;
    setMapReady(true);

    // 地図領域はカードのレイアウト後に確定するため、サイズ変化を追って再計算する。
    const observer = new ResizeObserver(() => clampMapToTown(map, townBounds));
    observer.observe(container);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, [center.lat, center.lng, mapBounds, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const layers = layersRef.current;
    let bounds: L.LatLngBounds | null = null;

    cats.forEach((cat) => {
      const position: L.LatLngExpression = [cat.center.lat, cat.center.lng];

      const circle = L.circle(position, { radius: cat.radius }).addTo(map);
      const marker = L.marker(position, {
        icon: createPinIcon(cat),
        title: cat.name,
        alt: `${cat.name}をえらぶ`
      }).addTo(map);

      const select = () => onSelectCat(cat.id);
      circle.on('click', select);
      marker.on('click', select);

      layers.set(cat.id, { circle, marker });
      const catBounds = circle.getBounds();
      bounds = bounds ? bounds.extend(catBounds) : catBounds;
    });

    // すべての縄張り円が画面に収まる範囲に合わせる。町外へは minZoom が止める。
    if (bounds) {
      map.fitBounds(bounds, { padding: [28, 28] });
    }
    clampMapToTown(map, toTownBounds(mapBounds));

    // マーカーは追加した時点のズーム/中心を基準に描画されるため、
    // 直後の fitBounds/clampMapToTown でビューが変わると位置がずれたまま残ることがある。
    // fitBounds と clampMapToTown の setZoom が別々にビュー変更をトリガーし、moveend が
    // 複数回に分かれて発火することがあるため、once ではなく on で毎回追従させる
    // （resyncMarkers は setLatLng を呼び直すだけの軽量な処理なので繰り返しても問題ない）。
    const resyncMarkers = () => layers.forEach(({ marker }) => marker.setLatLng(marker.getLatLng()));
    map.on('moveend', resyncMarkers);

    return () => {
      map.off('moveend', resyncMarkers);
      layers.forEach(({ circle, marker }) => {
        circle.remove();
        marker.remove();
      });
      layers.clear();
    };
  }, [cats, mapBounds, mapReady, onSelectCat]);

  useEffect(() => {
    const layers = layersRef.current;

    cats.forEach((cat) => {
      const layer = layers.get(cat.id);
      if (!layer) {
        return;
      }

      const selected = cat.id === selectedCatId;
      applyCircleStyle(layer.circle, cat, selected);
      layer.marker.getElement()?.classList.toggle('cat-pin--selected', selected);
    });
  }, [cats, mapReady, selectedCatId]);

  return (
    <div
      ref={containerRef}
      className="map-canvas"
      role="application"
      aria-label="平泉町の猫えらび地図"
    />
  );
}

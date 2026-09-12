import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useStudioStore } from '../../app/store';
import { buildingMapStatus } from '../../domain/catalog';
import { MAP_BOUNDS, MAP_CENTER, MAP_ZOOM } from '../../domain/constants';
import { OverlayBuilding } from '../../domain/project';

const STATUS_COLOR = {
  idle: '#6b7280',
  target: '#c05621',
  raw: '#2b6cb0',
  exported: '#2f6f4e'
} as const;

function markerLatLng(building: OverlayBuilding): [number, number] | null {
  if (building.lat == null || building.lng == null) {
    return null;
  }
  return [building.lat, building.lng];
}

export function MapScreen() {
  const overlay = useStudioStore((s) => s.overlay);
  const selectBuilding = useStudioStore((s) => s.selectBuilding);
  const setShootTarget = useStudioStore((s) => s.setShootTarget);
  const selectedBuildingId = useStudioStore((s) => s.selectedBuildingId);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const buildings = overlay?.buildings ?? [];
  const counts = useMemo(() => {
    const result = { idle: 0, target: 0, raw: 0, exported: 0 };
    for (const b of buildings) {
      result[buildingMapStatus(b)] += 1;
    }
    return result;
  }, [buildings]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) {
      return;
    }
    const bounds = L.latLngBounds(
      [MAP_BOUNDS.southWest.lat, MAP_BOUNDS.southWest.lng],
      [MAP_BOUNDS.northEast.lat, MAP_BOUNDS.northEast.lng]
    );
    const map = L.map(el, {
      center: [MAP_CENTER.lat, MAP_CENTER.lng],
      zoom: MAP_ZOOM,
      maxBounds: bounds.pad(0.2)
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const group = layerRef.current;
    if (!group) {
      return;
    }
    group.clearLayers();
    for (const building of buildings) {
      const pos = markerLatLng(building);
      if (!pos) {
        continue;
      }
      const status = buildingMapStatus(building);
      const marker = L.circleMarker(pos, {
        radius: selectedBuildingId === building.building_id ? 11 : 8,
        color: STATUS_COLOR[status],
        fillColor: STATUS_COLOR[status],
        fillOpacity: 0.85,
        weight: 2
      });
      marker.bindTooltip(
        `${building.name ?? building.building_id}${building.osm_id ? ` / OSM ${building.osm_id}` : ''}`
      );
      marker.on('click', () => selectBuilding(building.building_id));
      marker.addTo(group);
    }
  }, [buildings, selectBuilding, selectedBuildingId]);

  const selected = buildings.find((b) => b.building_id === selectedBuildingId);

  return (
    <div className="grid-2">
      <div>
        <div className="legend" style={{ marginBottom: 8 }}>
          <span>
            <i className="dot" style={{ background: STATUS_COLOR.idle }} /> 未対象 {counts.idle}
          </span>
          <span>
            <i className="dot" style={{ background: STATUS_COLOR.target }} /> 撮影対象 {counts.target}
          </span>
          <span>
            <i className="dot" style={{ background: STATUS_COLOR.raw }} /> 写真あり {counts.raw}
          </span>
          <span>
            <i className="dot" style={{ background: STATUS_COLOR.exported }} /> 出力済 {counts.exported}
          </span>
        </div>
        <div className="map-wrap" ref={containerRef} />
      </div>
      <section className="panel stack">
        <h2>撮影対象</h2>
        {!overlay ? <p className="muted">プロジェクトを作成し、buildings.json を取り込んでください。</p> : null}
        {selected ? (
          <div className="stack">
            <strong>{selected.name ?? selected.building_id}</strong>
            <span className="muted">{selected.building_id}</span>
            {selected.pendingGameId ? (
              <span className="muted">ゲーム JSON 未登録の仮IDです。</span>
            ) : null}
            <label>
              <input
                type="checkbox"
                checked={selected.isShootTarget}
                onChange={(e) => setShootTarget(selected.building_id, e.target.checked)}
              />{' '}
              撮影対象に登録
            </label>
            <button type="button" className="primary" onClick={() => selectBuilding(selected.building_id)}>
              建物詳細へ
            </button>
          </div>
        ) : (
          <p className="muted">地図上の点をクリックすると建物を選べます。</p>
        )}
        <div className="building-list">
          {buildings.map((b) => (
            <button
              key={b.building_id}
              type="button"
              className="building-row"
              onClick={() => selectBuilding(b.building_id)}
            >
              <span>
                {b.name ?? b.building_id}
                <br />
                <span className={`muted status-${buildingMapStatus(b)}`}>{b.building_id}</span>
              </span>
              <span className={`status-${buildingMapStatus(b)}`}>{buildingMapStatus(b)}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { PatrolMinimap } from '../../components/map/PatrolMinimap';
import { PatrolScene } from '../../components/three/PatrolScene';
import { VirtualStick } from '../../components/ui/VirtualStick';
import { PlayerPose } from '../../domain/session/playerInput';
import { distance2d, latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';
import { usePlayerInput } from './usePlayerInput';

export function PatrolScreen() {
  const cats = useAppStore((state) => state.cats);
  const hydrants = useAppStore((state) => state.hydrants);
  const buildings = useAppStore((state) => state.buildings);
  const roads = useAppStore((state) => state.roads);
  const gameConfig = useAppStore((state) => state.gameConfig);
  const currentSession = useAppStore((state) => state.currentSession);
  const messages = useAppStore((state) => state.messages);
  const tickPatrol = useAppStore((state) => state.tickPatrol);
  const inspectHydrant = useAppStore((state) => state.inspectHydrant);
  const goToMap = useAppStore((state) => state.goToMap);
  const failScene = useAppStore((state) => state.failScene);
  const lastInspectAtRef = useRef(0);
  const lastBoundaryAtRef = useRef(0);
  const [inspectableId, setInspectableId] = useState<string | null>(null);
  const [boundaryVisible, setBoundaryVisible] = useState(false);
  const [inspectFlash, setInspectFlash] = useState(false);
  const [playerPose, setPlayerPose] = useState<PlayerPose | null>(null);
  const { inputRef, setStick } = usePlayerInput();

  const selectedCat = useMemo(() => {
    if (!currentSession) {
      return null;
    }
    return cats.find((cat) => cat.id === currentSession.catId) ?? null;
  }, [cats, currentSession]);

  const nearbyHydrants = useMemo(() => {
    if (!selectedCat) {
      return [];
    }

    const origin = gameConfig.defaultMapCenter;
    const catWorld = latLngToWorldPosition(selectedCat.center.lat, selectedCat.center.lng, origin);

    return hydrants
      .filter((hydrant) => hydrant.status === 'active')
      .filter((hydrant) => {
        const hydrantWorld = latLngToWorldPosition(hydrant.lat, hydrant.lng, origin);
        return distance2d(catWorld, hydrantWorld) <= selectedCat.radius;
      });
  }, [gameConfig.defaultMapCenter, hydrants, selectedCat]);

  const nearbyRoads = useMemo(() => {
    if (!selectedCat) {
      return [];
    }

    const origin = gameConfig.defaultMapCenter;
    const catWorld = latLngToWorldPosition(selectedCat.center.lat, selectedCat.center.lng, origin);
    const maxDist = selectedCat.radius + 30;

    return roads.filter((road) =>
      road.path.some((point) => {
        const world = latLngToWorldPosition(point.lat, point.lng, origin);
        return distance2d(catWorld, world) <= maxDist;
      })
    );
  }, [gameConfig.defaultMapCenter, roads, selectedCat]);

  const onInspectableChange = useCallback((hydrantId: string | null) => {
    setInspectableId(hydrantId);
  }, []);

  const onPlayerPose = useCallback((pose: PlayerPose) => {
    setPlayerPose(pose);
  }, []);

  const onBoundary = useCallback(() => {
    const now = Date.now();
    if (now - lastBoundaryAtRef.current < 3000) {
      return;
    }

    lastBoundaryAtRef.current = now;
    setBoundaryVisible(true);
    window.setTimeout(() => setBoundaryVisible(false), 1500);
  }, []);

  useEffect(() => {
    if (!currentSession || currentSession.finished) {
      return;
    }

    const timer = window.setInterval(() => {
      tickPatrol();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentSession, tickPatrol]);

  if (!currentSession || !selectedCat) {
    return null;
  }

  const canInspect =
    Boolean(inspectableId) && currentSession.remainingSec > 0 && !currentSession.finished;

  const handleInspect = () => {
    if (!inspectableId || currentSession.remainingSec <= 0) {
      return;
    }

    const now = Date.now();
    if (now - lastInspectAtRef.current < 800) {
      return;
    }

    lastInspectAtRef.current = now;
    inspectHydrant(inspectableId);
    setInspectFlash(true);
    window.setTimeout(() => setInspectFlash(false), 800);
  };

  return (
    <main className="patrol-screen">
      <PatrolScene
        cat={selectedCat}
        hydrants={nearbyHydrants}
        buildings={buildings}
        roads={nearbyRoads}
        origin={gameConfig.defaultMapCenter}
        mapBounds={gameConfig.mapBounds}
        moveSpeedMps={gameConfig.playerMoveSpeedMps}
        inspectRadiusMeters={gameConfig.inspectRadiusMeters}
        inspectedHydrantIds={currentSession.inspectedHydrantIds}
        inputRef={inputRef}
        onInspectableChange={onInspectableChange}
        onPlayerPose={onPlayerPose}
        onBoundary={onBoundary}
        onFatalError={failScene}
      />

      <header className="patrol-hud">
        <div className="patrol-hud__chip">
          残り {currentSession.remainingSec}s
        </div>
        <div className="patrol-hud__chip">
          点検 {currentSession.inspectedHydrantIds.length} / {nearbyHydrants.length}
        </div>
        <div className="patrol-hud__chip">スコア {currentSession.score}</div>
        <button className="patrol-hud__quit" type="button" onClick={() => goToMap()}>
          × やめる
        </button>
      </header>

      {playerPose ? (
        <PatrolMinimap
          cat={selectedCat}
          hydrants={nearbyHydrants}
          inspectedHydrantIds={currentSession.inspectedHydrantIds}
          origin={gameConfig.defaultMapCenter}
          mapBounds={gameConfig.mapBounds}
          pose={playerPose}
        />
      ) : null}
      {boundaryVisible ? <p className="patrol-toast">{messages.boundary}</p> : null}
      {inspectFlash ? <p className="patrol-toast patrol-toast--inspect">{messages.inspectSuccess}</p> : null}

      <div className="patrol-whisker" aria-hidden="true">
        <span className="patrol-whisker__line patrol-whisker__line--left" />
        <span className="patrol-whisker__nose" />
        <span className="patrol-whisker__line patrol-whisker__line--right" />
      </div>

      <div className="patrol-controls">
        <VirtualStick onChange={setStick} />
        <button
          className="patrol-inspect"
          type="button"
          disabled={!canInspect}
          onClick={handleInspect}
        >
          てんけんする
        </button>
      </div>
    </main>
  );
}

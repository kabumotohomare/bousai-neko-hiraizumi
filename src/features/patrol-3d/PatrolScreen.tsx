import { PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { PatrolMinimap } from '../../components/map/PatrolMinimap';
import { PatrolScene } from '../../components/three/PatrolScene';
import { VirtualStick } from '../../components/ui/VirtualStick';
import { isHydrantInTerritory } from '../../domain/hydrant/inTerritory';
import { hydrantWorldPosition } from '../../domain/hydrant/worldPosition';
import { PlayerPose } from '../../domain/session/playerInput';
import { distance2d, latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';
import { usePlayerInput } from './usePlayerInput';

// スマホの実機ではポインタが確実に coarse になるが、PCブラウザの
// レスポンシブデザインモードは「タッチのシミュレート」を有効にしない限り
// pointer: coarse を報告しない（画面幅だけスマホサイズにした場合など）。
// 見た目がスマホ幅なら、実際のポインタ種別によらずダッシュボタンを
// 出したいので、画面幅もあわせて見る。
const MOBILE_MAX_WIDTH_PX = 768;

function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

function isNarrowViewport(): boolean {
  return typeof window !== 'undefined' && window.innerWidth <= MOBILE_MAX_WIDTH_PX;
}

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
  const pausePatrol = useAppStore((state) => state.pausePatrol);
  const resumePatrol = useAppStore((state) => state.resumePatrol);
  const goToMap = useAppStore((state) => state.goToMap);
  const failScene = useAppStore((state) => state.failScene);
  const lastInspectAtRef = useRef(0);
  const lastBoundaryAtRef = useRef(0);
  const lastObstacleHitAtRef = useRef(0);
  const [inspectableId, setInspectableId] = useState<string | null>(null);
  const [boundaryVisible, setBoundaryVisible] = useState(false);
  const [inspectFlash, setInspectFlash] = useState(false);
  const [obstacleLine, setObstacleLine] = useState<string | null>(null);
  const [playerPose, setPlayerPose] = useState<PlayerPose | null>(null);
  const [touchLatched, setTouchLatched] = useState(isCoarsePointer);
  const [narrowViewport, setNarrowViewport] = useState(isNarrowViewport);
  const showDashButton = touchLatched || narrowViewport;
  const [stickMoving, setStickMoving] = useState(false);
  const { inputRef, setStick, setDash, dashing } = usePlayerInput();

  const handleStick = useCallback(
    (forward: number, turn: number) => {
      setStick(forward, turn);
      setStickMoving(Math.abs(forward) > 0.12);
    },
    [setStick]
  );

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
        const hydrantWorld = hydrantWorldPosition(hydrant, origin);
        return isHydrantInTerritory(hydrantWorld, catWorld, selectedCat.radius);
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

  const onObstacleHit = useCallback(() => {
    const now = Date.now();
    if (now - lastObstacleHitAtRef.current < 1800) {
      return;
    }

    lastObstacleHitAtRef.current = now;
    const lines = messages.obstacleHit;
    setObstacleLine(lines[Math.floor(Math.random() * lines.length)]);
    window.setTimeout(() => setObstacleLine(null), 1100);
  }, [messages.obstacleHit]);

  useEffect(() => {
    if (!currentSession || currentSession.finished || currentSession.paused) {
      return;
    }

    const timer = window.setInterval(() => {
      tickPatrol();
    }, 1000);

    return () => window.clearInterval(timer);
  }, [currentSession, tickPatrol]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') {
        setTouchLatched(true);
      }
    };
    const onResize = () => setNarrowViewport(isNarrowViewport());

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const holdDash = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      setDash(true, event.pointerId);
    },
    [setDash]
  );

  if (!currentSession || !selectedCat) {
    return null;
  }

  const canInspect =
    Boolean(inspectableId) &&
    currentSession.remainingSec > 0 &&
    !currentSession.finished &&
    !currentSession.paused;

  const handleInspect = () => {
    if (!inspectableId || currentSession.remainingSec <= 0 || currentSession.paused) {
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
    <main
      className={[
        'patrol-screen',
        dashing ? 'is-dashing' : '',
        dashing && stickMoving ? 'is-running' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <PatrolScene
        cat={selectedCat}
        hydrants={nearbyHydrants}
        buildings={buildings}
        roads={nearbyRoads}
        origin={gameConfig.defaultMapCenter}
        mapBounds={gameConfig.mapBounds}
        moveSpeedMps={gameConfig.playerMoveSpeedMps}
        dashSpeedMps={currentSession.dashSpeedMps}
        inspectRadiusMeters={gameConfig.inspectRadiusMeters}
        inspectedHydrantIds={currentSession.inspectedHydrantIds}
        paused={currentSession.paused}
        inputRef={inputRef}
        onInspectableChange={onInspectableChange}
        onPlayerPose={onPlayerPose}
        onBoundary={onBoundary}
        onObstacleHit={onObstacleHit}
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
        <button
          className="patrol-hud__pause"
          type="button"
          aria-label="ポーズ"
          onClick={() => pausePatrol()}
        >
          ❚❚
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
      {inspectFlash ? <p className="patrol-toast patrol-toast--inspect">{messages.inspectSuccess}</p> : null}

      {boundaryVisible ? <p className="patrol-speech">{messages.boundary}</p> : null}
      {obstacleLine ? <p className="patrol-speech">{obstacleLine}</p> : null}

      <div className="patrol-whisker" aria-hidden="true">
        <span className="patrol-whisker__line patrol-whisker__line--left" />
        <span className="patrol-whisker__nose" />
        <span className="patrol-whisker__line patrol-whisker__line--right" />
      </div>

      {dashing && stickMoving ? (
        <div className="patrol-run-streaks" aria-hidden="true" />
      ) : null}

      <div className="patrol-controls">
        <VirtualStick onChange={handleStick} />
        {showDashButton ? (
          <button
            className={dashing ? 'patrol-dash is-active' : 'patrol-dash'}
            type="button"
            aria-label="はしる"
            aria-pressed={dashing}
            onPointerDown={holdDash}
            onContextMenu={(event) => event.preventDefault()}
          >
            <span className="patrol-dash__label">
              {dashing && stickMoving ? 'はしってる' : 'はしる'}
            </span>
            <span className="patrol-dash__caption">
              {dashing ? (stickMoving ? 'はやく うごく' : 'スティックで うごく') : 'おしたまま うごく'}
            </span>
          </button>
        ) : (
          <p className="patrol-dash-hint">Shift ではしる</p>
        )}
        <button
          className="patrol-inspect"
          type="button"
          disabled={!canInspect}
          onClick={handleInspect}
        >
          てんけんする
        </button>
      </div>

      {currentSession.paused ? (
        <div className="patrol-pause-overlay">
          <div className="patrol-pause-card card stack">
            <h2 className="title">ポーズちゅう</h2>
            <p className="subtitle">残り {currentSession.remainingSec}s</p>
            <button className="primary-button" type="button" onClick={() => resumePatrol()}>
              つづきから
            </button>
            <button className="secondary-button" type="button" onClick={() => goToMap()}>
              ねこえらびにもどる
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}

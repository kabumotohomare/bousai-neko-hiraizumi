import { useMemo, useState } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { Cat } from '../../domain/cat/model';
import {
  buildScenarioContext,
  DIRECTION_LABELS,
  DirectionLabel,
  ScenarioContext
} from '../../domain/scenario/context';
import { buildScenarioVars, fill, ScenarioLines, selectLines } from '../../domain/scenario/lines';

type Slide = 0 | 1 | 2 | 3 | 4;
const LAST_SLIDE: Slide = 4;

/**
 * S04 リザルト。
 * 90秒で人格は猫から出る。出る直前、猫から借りた3つの感覚（目・鼻・足）で今日を残す。
 * スライド: 切断 → 目(記録) → 鼻 → 足 → ねむり。
 * 文言は messages.scenario、分岐は domain/scenario が担い、ここは表示だけ。
 * 画面の雰囲気（data-mood）は記録の進み具合（mapBranch）で夜→朝に変わる。
 */
export function ResultScreen() {
  const currentSession = useAppStore((state) => state.currentSession);
  const cats = useAppStore((state) => state.cats);
  const hydrants = useAppStore((state) => state.hydrants);
  const messages = useAppStore((state) => state.messages);
  const gameConfig = useAppStore((state) => state.gameConfig);
  const goToMap = useAppStore((state) => state.goToMap);
  const replayPatrol = useAppStore((state) => state.replayPatrol);

  const [slide, setSlide] = useState<Slide>(0);

  const selectedCat = useMemo(() => {
    if (!currentSession) {
      return null;
    }
    return cats.find((cat) => cat.id === currentSession.catId) ?? null;
  }, [cats, currentSession]);

  const scenario = useMemo(() => {
    if (!currentSession || !selectedCat) {
      return null;
    }
    const ctx = buildScenarioContext({
      cat: selectedCat,
      cats,
      hydrants,
      session: currentSession,
      origin: gameConfig.defaultMapCenter
    });
    return { ctx, lines: selectLines(ctx, messages.scenario), vars: buildScenarioVars(ctx) };
  }, [cats, currentSession, gameConfig.defaultMapCenter, hydrants, messages.scenario, selectedCat]);

  if (!currentSession || !selectedCat || !scenario) {
    return null;
  }

  const { ctx, lines, vars } = scenario;
  const s = messages.scenario;
  const isLast = slide === LAST_SLIDE;
  const sleepingCat = cats.find((cat) => cat.id === ctx.sleepingCats[0]?.id) ?? null;

  return (
    <main className="app-shell stack result-screen" data-slide={slide} data-mood={lines.mapBranch}>
      <section className="card stack result-head">
        <h1 className="title">{s.resultTitle}</h1>
        <p className="result-cat">
          {selectedCat.name} ／ {ctx.alias}
        </p>

        <ol className="result-steps" aria-label="シナリオの進み">
          {s.slideLabels.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                className={`result-step${index === slide ? ' is-active' : ''}${index < slide ? ' is-done' : ''}`}
                aria-current={index === slide ? 'step' : undefined}
                onClick={() => setSlide(index as Slide)}
              >
                {label}
              </button>
            </li>
          ))}
        </ol>
      </section>

      {slide === 0 ? (
        <section
          className="card stack result-slide result-slide--disconnect"
          aria-labelledby="result-slide-0"
        >
          <CatPortrait cat={selectedCat} mood={lines.mapBranch} />
          <h2 id="result-slide-0" className="result-line result-line--lead">
            {fill(s.disconnectIntro, vars)}
          </h2>
          <p className="subtitle">{s.disconnectSub}</p>
          <ul className="result-senses" aria-label="かりた 3つの かんかく">
            <li>
              <strong>{s.slideLabels[1]}</strong>
              <span>{s.senseHints.map}</span>
            </li>
            <li>
              <strong>{s.slideLabels[2]}</strong>
              <span>{s.senseHints.nose}</span>
            </li>
            <li>
              <strong>{s.slideLabels[3]}</strong>
              <span>{s.senseHints.feet}</span>
            </li>
          </ul>
        </section>
      ) : null}

      {slide === 1 ? (
        <section className="card stack result-slide" aria-labelledby="result-slide-1">
          <SenseHeader id="result-slide-1" label={s.slideLabels[1]} hint={s.senseHints.map} />
          <p className="subtitle">{s.progressLabel}</p>
          <div
            className="result-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={ctx.total}
            aria-valuenow={ctx.knownCount}
            aria-label={`${ctx.knownCount} / ${ctx.total}`}
          >
            <span
              className="result-progress__bar"
              style={{ width: `${Math.round(ctx.knownRate * 100)}%` }}
            />
          </div>
          <p className="result-count">
            <strong>{ctx.knownCount}</strong> / {ctx.total}
            <span className="result-count__sub">
              （{s.todayTag} {ctx.inspectedCount}つ）
            </span>
          </p>
          <ul className="result-marks" aria-label="赤いしるしの一覧">
            {ctx.marks.map((mark) => (
              <li
                key={mark.id}
                className={`result-mark${mark.known ? ' is-known' : ''}${mark.inspectedThisRun ? ' is-new' : ''}`}
              >
                <span className="result-mark__dot" aria-hidden="true">
                  {mark.known ? '●' : '○'}
                </span>
                <span className="result-mark__label">{mark.label}</span>
                {mark.inspectedThisRun ? (
                  <span className="result-mark__tag">{s.todayTag}</span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="result-line">{lines.mapLine}</p>
          {lines.mapGainedLine ? <p className="subtitle">{lines.mapGainedLine}</p> : null}
        </section>
      ) : null}

      {slide === 2 ? (
        <section className="card stack result-slide" aria-labelledby="result-slide-2">
          <SenseHeader id="result-slide-2" label={s.slideLabels[2]} hint={s.senseHints.nose} />
          <Compass ctx={ctx} />
          {lines.noseLines.map((line) => (
            <p key={line} className="result-line">
              {line}
            </p>
          ))}
        </section>
      ) : null}

      {slide === 3 ? (
        <section className="card stack result-slide" aria-labelledby="result-slide-3">
          <SenseHeader id="result-slide-3" label={s.slideLabels[3]} hint={s.senseHints.feet} />
          <FeetBars
            ctx={ctx}
            nowLabel={s.feetNowLabel}
            prevLabel={s.feetPrevLabel}
            durationSec={gameConfig.gameDurationSec}
          />
          <p className="result-line">{lines.feetLine}</p>
          {lines.feetPrevLine ? <p className="subtitle">{lines.feetPrevLine}</p> : null}
        </section>
      ) : null}

      {slide === 4 ? (
        <section
          className="card stack result-slide result-slide--sleep"
          aria-labelledby="result-slide-4"
        >
          <CatPortrait cat={selectedCat} mood={lines.mapBranch} sleeping />
          <h2 id="result-slide-4" className="result-line result-line--lead">
            {s.sleepIntro}
          </h2>
          <p className="subtitle">{s.sleepSub}</p>
          {sleepingCat ? (
            <SleepingCard cat={sleepingCat} badge={s.sleepingBadge} lines={lines} />
          ) : null}
          <p className="result-closing">{lines.closingLine}</p>
        </section>
      ) : null}

      <section className="card stack result-actions">
        {!isLast ? (
          <button className="primary-button" onClick={() => setSlide((slide + 1) as Slide)}>
            {s.nextSlide}
          </button>
        ) : (
          <>
            <button className="primary-button" onClick={() => replayPatrol()}>
              もういちど遊ぶ
            </button>
            <button className="secondary-button" onClick={() => goToMap()}>
              べつのねこで遊ぶ
            </button>
            <a
              className="secondary-button"
              href={gameConfig.reportFormUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}
            >
              ねこの もくげきほうこくをする
            </a>
          </>
        )}
      </section>
    </main>
  );
}

function SenseHeader({ id, label, hint }: { id: string; label: string; hint: string }) {
  return (
    <header className="result-sense">
      <h2 id={id} className="result-slide__title">
        {label}
      </h2>
      <p className="result-sense__hint">{hint}</p>
    </header>
  );
}

/**
 * （ねむり時は寝ポーズ →）イラスト → 写真 の順に試し、どれも無ければ null。
 * 読み込み失敗時は次の候補へ落ちる。
 */
function useCatImage(cat: Cat, sleeping = false): { src: string | null; onError: () => void } {
  const candidates = useMemo(
    () =>
      [sleeping ? cat.sleepIllustUrl : undefined, cat.illustUrl, cat.photoUrl].filter(
        (url): url is string => Boolean(url)
      ),
    [cat.illustUrl, cat.photoUrl, cat.sleepIllustUrl, sleeping]
  );
  const [failed, setFailed] = useState<string[]>([]);
  const src = candidates.find((url) => !failed.includes(url)) ?? null;
  return { src, onError: () => (src ? setFailed((prev) => [...prev, src]) : undefined) };
}

/**
 * 人格が借りている体（猫）の顔。イラストがあればそれを、無ければ写真を使う。
 * 眠っている表示はグレースケール。
 */
function CatPortrait({
  cat,
  mood,
  sleeping = false
}: {
  cat: Cat;
  mood: string;
  sleeping?: boolean;
}) {
  const { src, onError } = useCatImage(cat, sleeping);
  const usingSleepPose = sleeping && src !== null && src === cat.sleepIllustUrl;
  return (
    <figure
      className={`result-portrait${sleeping ? ' is-sleeping' : ''}${usingSleepPose ? ' has-sleep-pose' : ''}`}
      data-mood={mood}
    >
      <span className="result-portrait__ring" aria-hidden="true" />
      {src ? (
        <img className="result-portrait__img" src={src} alt="" onError={onError} />
      ) : (
        <span className="result-portrait__fallback" aria-hidden="true" />
      )}
      <figcaption className="result-portrait__name">{cat.name}</figcaption>
    </figure>
  );
}

/** 鼻: スタート地点から見た8方位。未記録のしるしを点で置き、いちばん近いものに矢印を向ける。 */
function Compass({ ctx }: { ctx: ScenarioContext }) {
  const nearest = ctx.nearestMissed;
  const angleOf = (direction: DirectionLabel) => DIRECTION_LABELS.indexOf(direction) * 45;
  const maxDistance = Math.max(1, ...ctx.marks.map((mark) => mark.distanceM));

  return (
    <div
      className="result-compass"
      role="img"
      aria-label={nearest ? `${nearest.label} の方角` : 'しらない においは ない'}
    >
      <span className="result-compass__ring" aria-hidden="true" />
      {DIRECTION_LABELS.filter((_, index) => index % 2 === 0).map((label) => (
        <span
          key={label}
          className="result-compass__label"
          style={{
            transform: `rotate(${angleOf(label)}deg) translateY(-86px) rotate(-${angleOf(label)}deg)`
          }}
          aria-hidden="true"
        >
          {label}
        </span>
      ))}
      {ctx.marks.map((mark) => {
        const radius = 22 + (mark.distanceM / maxDistance) * 48;
        return (
          <span
            key={mark.id}
            className={`result-compass__mark${mark.known ? ' is-known' : ''}`}
            style={{ transform: `rotate(${angleOf(mark.direction)}deg) translateY(-${radius}px)` }}
            aria-hidden="true"
          />
        );
      })}
      {nearest ? (
        <span
          className="result-compass__arrow"
          style={{ transform: `rotate(${angleOf(nearest.direction)}deg)` }}
          aria-hidden="true"
        />
      ) : (
        <span className="result-compass__center" aria-hidden="true" />
      )}
    </div>
  );
}

/** 足: 今日と前回の「最後のしるしまでの秒数」を横棒で並べる。 */
function FeetBars({
  ctx,
  nowLabel,
  prevLabel,
  durationSec
}: {
  ctx: ScenarioContext;
  nowLabel: string;
  prevLabel: string;
  durationSec: number;
}) {
  const now = ctx.lastMarkSec;
  const prev = ctx.previousRun?.lastMarkSec ?? null;
  const width = (sec: number | null) =>
    sec === null ? 0 : Math.min(100, Math.round((sec / durationSec) * 100));

  return (
    <div className="result-feet" aria-label="さいごの しるしまでの 秒数">
      <div className="result-feet__row">
        <span className="result-feet__label">{nowLabel}</span>
        <span className="result-feet__track">
          <span className="result-feet__bar is-now" style={{ width: `${width(now)}%` }} />
        </span>
        <span className="result-feet__value">{now === null ? '—' : `${now}秒`}</span>
      </div>
      <div className="result-feet__row">
        <span className="result-feet__label">{prevLabel}</span>
        <span className="result-feet__track">
          <span className="result-feet__bar is-prev" style={{ width: `${width(prev)}%` }} />
        </span>
        <span className="result-feet__value">{prev === null ? '—' : `${prev}秒`}</span>
      </div>
    </div>
  );
}

/** 体を待っている人格。 */
function SleepingCard({ cat, badge, lines }: { cat: Cat; badge: string; lines: ScenarioLines }) {
  const { src, onError } = useCatImage(cat);
  return (
    <aside className="result-sleeping" aria-label={`${cat.name}（${badge}）`}>
      {src ? <img className="result-sleeping__img" src={src} alt="" onError={onError} /> : null}
      <div className="result-sleeping__body">
        <span className="result-sleeping__badge">{badge}</span>
        <strong>{cat.name}</strong>
        <span className="subtitle">{cat.aliasName ?? ''}</span>
        {lines.closingBranch === 'sleeping' && cat.catchphrase ? (
          <span className="result-sleeping__quote">「{cat.catchphrase}」</span>
        ) : null}
      </div>
    </aside>
  );
}

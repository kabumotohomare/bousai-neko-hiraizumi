import { useMemo, useState } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { buildScenarioContext } from '../../domain/scenario/context';
import { selectLines } from '../../domain/scenario/lines';

type Slide = 0 | 1 | 2;

/**
 * S04 リザルト。
 * ゲーム結果をシナリオ（記録 → 鼻 → 足）の3スライドで見せる。
 * 文言は messages.scenario、分岐は domain/scenario が担い、ここは表示だけ。
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
    return { ctx, lines: selectLines(ctx, messages.scenario) };
  }, [cats, currentSession, gameConfig.defaultMapCenter, hydrants, messages.scenario, selectedCat]);

  if (!currentSession || !selectedCat || !scenario) {
    return null;
  }

  const { ctx, lines } = scenario;
  const s = messages.scenario;
  const percent = Math.round(ctx.knownRate * 100);
  const isLast = slide === 2;

  return (
    <main className="app-shell stack result-screen" data-slide={slide}>
      <section className="card stack">
        <p className="subtitle">{s.resultIntro}</p>
        <h1 className="title">{s.resultTitle}</h1>
        <p className="subtitle result-cat">
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
        <section className="card stack result-slide" aria-labelledby="result-slide-map">
          <h2 id="result-slide-map" className="result-slide__title">
            {s.slideLabels[0]}
          </h2>
          <p className="subtitle">{s.progressLabel}</p>
          <div
            className="result-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={ctx.total}
            aria-valuenow={ctx.knownCount}
            aria-label={`${ctx.knownCount} / ${ctx.total}`}
          >
            <span className="result-progress__bar" style={{ width: `${percent}%` }} />
          </div>
          <p className="result-count">
            <strong>{ctx.knownCount}</strong> / {ctx.total}
            <span className="result-count__sub">（きょう {ctx.inspectedCount}つ）</span>
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
                {mark.inspectedThisRun ? <span className="result-mark__tag">きょう</span> : null}
              </li>
            ))}
          </ul>
          <p className="result-line">{lines.mapLine}</p>
          {lines.mapGainedLine ? <p className="subtitle">{lines.mapGainedLine}</p> : null}
        </section>
      ) : null}

      {slide === 1 ? (
        <section className="card stack result-slide" aria-labelledby="result-slide-nose">
          <h2 id="result-slide-nose" className="result-slide__title">
            {s.slideLabels[1]}
          </h2>
          {lines.noseLines.map((line) => (
            <p key={line} className="result-line">
              {line}
            </p>
          ))}
        </section>
      ) : null}

      {slide === 2 ? (
        <section className="card stack result-slide" aria-labelledby="result-slide-feet">
          <h2 id="result-slide-feet" className="result-slide__title">
            {s.slideLabels[2]}
          </h2>
          <p className="result-line">{lines.feetLine}</p>
          {lines.feetPrevLine ? <p className="subtitle">{lines.feetPrevLine}</p> : null}
          <p className="result-closing">{lines.closingLine}</p>
        </section>
      ) : null}

      <section className="card stack">
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

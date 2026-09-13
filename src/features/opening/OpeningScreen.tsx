import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { unlockAndPlayBgm } from '../../services/audio/bgm';

/**
 * 猫えらびの前に出す OP。
 * 開始前は枠内でミュートループ。「はじめる」または再生で BGM を開始し、
 * 映像を頭から1回再生。終わると猫えらびへ進む。スキップでも進める。
 */
export function OpeningScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const finishOpening = useAppStore((state) => state.finishOpening);
  const [started, setStarted] = useState(false);

  const stopVideo = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    stopVideo();
    finishOpening();
  }, [finishOpening, stopVideo]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    video.muted = true;
    void video.play().catch(() => {
      /* ユーザー操作待ち */
    });
  }, [finish]);

  useEffect(() => () => stopVideo(), [stopVideo]);

  const start = async () => {
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      video.loop = false;
      video.currentTime = 0;
      try {
        await video.play();
      } catch {
        /* BGM だけでも続ける */
      }
    }

    try {
      await unlockAndPlayBgm();
    } catch {
      /* 映像は続ける */
    }
    setStarted(true);
  };

  return (
    <main className="opening opening--stage" aria-label="オープニング">
      <button className="opening__skip" type="button" onClick={finish}>
        スキップ
      </button>

      <div className="opening__stage">
        <div className="opening__frame">
          <video
            ref={videoRef}
            className="opening__video"
            src="/op/op.mp4"
            poster="/op/op-poster.jpg"
            loop
            muted
            playsInline
            preload="auto"
            onError={finish}
            onEnded={finish}
          />
          {!started ? (
            <button
              className="opening__play"
              type="button"
              onClick={() => void start()}
              aria-label="映像を再生する"
            >
              <span className="opening__play-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
                  <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                </svg>
              </span>
            </button>
          ) : null}
        </div>

        {!started ? (
          <div className="opening__copy">
            <h1 className="opening__title">ぼうさいネコ＠平泉</h1>
            <p className="opening__lead">150秒だけ、猫になる。</p>
          </div>
        ) : null}
      </div>

      <div className="opening__dock">
        {started ? (
          <p className="opening__hint">映像がおわると、猫をえらべます。待たずに進むときはスキップ。</p>
        ) : (
          <button className="primary-button opening__start" type="button" onClick={() => void start()}>
            はじめる
          </button>
        )}
      </div>
    </main>
  );
}

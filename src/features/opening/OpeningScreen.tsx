import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { unlockAndPlayBgm } from '../../services/audio/bgm';

/**
 * 猫えらびの前に出す OP。
 * 映像はループ。「はじめる」で BGM を開始し、映像と同時に流し続ける。
 * 「スキップ」で猫えらびへ。BGM は選択画面でも継続（見回り開始で止める）。
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
      if (video.paused) {
        try {
          await video.play();
        } catch {
          /* BGM だけでも続ける */
        }
      }
    }

    try {
      await unlockAndPlayBgm();
    } catch {
      /* 映像ループは続ける */
    }
    setStarted(true);
  };

  return (
    <main className="opening" aria-label="オープニング">
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
      />
      {!started ? (
        <div className="opening__cover">
          <h1 className="opening__title">ぼうさいネコ＠平泉</h1>
          <p className="opening__lead">150秒だけ、猫になる。</p>
          <button className="primary-button opening__start" type="button" onClick={() => void start()}>
            はじめる
          </button>
        </div>
      ) : null}
      <button className="opening__skip" type="button" onClick={finish}>
        スキップ
      </button>
    </main>
  );
}

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../app/store/useAppStore';
import { playEndingBgm, stopEndingBgm } from '../../services/audio/bgm';

/**
 * 「今日もう帰るにゃ」のあとに出すエンディング。
 * 映像はループ、BGM は別トラックでループ。スキップで猫えらびへ戻る。
 */
export function EndingScreen() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const finishedRef = useRef(false);
  const finishEnding = useAppStore((state) => state.finishEnding);

  const stopVideo = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const finish = useCallback(() => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    stopVideo();
    stopEndingBgm();
    finishEnding();
  }, [finishEnding, stopVideo]);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    const video = videoRef.current;
    if (video) {
      video.muted = true;
      void video.play().catch(() => {
        /* 失敗しても BGM とスキップは使える */
      });
    }
    void playEndingBgm();
  }, [finish]);

  useEffect(
    () => () => {
      stopVideo();
    },
    [stopVideo]
  );

  return (
    <main className="opening ending" aria-label="エンディング">
      <video
        ref={videoRef}
        className="opening__video"
        src="/op/ending.mp4"
        poster="/op/ending-poster.jpg"
        loop
        muted
        playsInline
        preload="auto"
        onError={finish}
      />
      <button className="opening__skip" type="button" onClick={finish}>
        スキップ
      </button>
    </main>
  );
}

const THEME_SONG_URL = '/audio/theme-song.mp3';
const THEME_SONG_VOLUME = 0.6;

// S03(みまわり)開始からS04(リザルト)まで鳴り続ける劇中歌。
// PatrolScreen/ResultScreenはS03→S04の画面遷移でアンマウントされるため、
// Reactコンポーネントにライフサイクルを持たせるとリザルト画面遷移時に
// 音が切れてしまう。Reactの外(モジュールスコープ)に1つだけ持つことで、
// 画面が切り替わっても再生を継続させる。
let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(THEME_SONG_URL);
    audio.loop = true;
    audio.volume = THEME_SONG_VOLUME;
  }
  return audio;
}

/**
 * みまわり開始のユーザー操作(ボタンクリック)と同じ呼び出しの中で
 * 同期的に呼ぶこと。ブラウザの自動再生ポリシー上、ユーザー操作から
 * 離れたタイミング(Reactのエフェクト内など)で呼ぶとブロックされうる。
 * 既に再生中(「もう一回」からの再開始など)なら、頭から鳴らし直さず
 * そのまま鳴り続けさせる。
 */
export function playThemeSong(): void {
  const element = getAudio();
  if (!element.paused) {
    return;
  }
  element.play().catch(() => {
    // 自動再生がブロックされても、ゲーム進行自体は止めない。
  });
}

/** ねこえらびに戻る操作で呼ぶ。次にみまわりを始めたとき、曲を最初から鳴らす。 */
export function stopThemeSong(): void {
  if (!audio) {
    return;
  }
  audio.pause();
  audio.currentTime = 0;
}

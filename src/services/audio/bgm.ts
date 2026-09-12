const MENU_BGM_SRC = '/op/bgm.m4a';
const PATROL_BGM_SRC = '/op/patrol-bgm.m4a';
const ENDING_BGM_SRC = '/op/ending-bgm.m4a';

let menuAudio: HTMLAudioElement | null = null;
let patrolAudio: HTMLAudioElement | null = null;
let endingAudio: HTMLAudioElement | null = null;
let unlocked = false;

function getMenuAudio(): HTMLAudioElement {
  if (!menuAudio) {
    menuAudio = new Audio(MENU_BGM_SRC);
    menuAudio.loop = true;
    menuAudio.preload = 'auto';
  }
  return menuAudio;
}

function getPatrolAudio(): HTMLAudioElement {
  if (!patrolAudio) {
    patrolAudio = new Audio(PATROL_BGM_SRC);
    patrolAudio.loop = true;
    patrolAudio.preload = 'auto';
  }
  return patrolAudio;
}

function getEndingAudio(): HTMLAudioElement {
  if (!endingAudio) {
    endingAudio = new Audio(ENDING_BGM_SRC);
    endingAudio.loop = true;
    endingAudio.preload = 'auto';
  }
  return endingAudio;
}

function exposeForTests() {
  if (typeof window === 'undefined') {
    return;
  }
  const w = window as Window & {
    __bousaiBgm?: HTMLAudioElement;
    __bousaiPatrolBgm?: HTMLAudioElement;
    __bousaiEndingBgm?: HTMLAudioElement;
  };
  if (menuAudio) {
    w.__bousaiBgm = menuAudio;
  }
  if (patrolAudio) {
    w.__bousaiPatrolBgm = patrolAudio;
  }
  if (endingAudio) {
    w.__bousaiEndingBgm = endingAudio;
  }
}

/** ユーザー操作の直後に呼ぶ。OP〜猫えらびで流し続ける。 */
export async function unlockAndPlayBgm(): Promise<void> {
  unlocked = true;
  const el = getMenuAudio();
  exposeForTests();
  pausePatrolBgm();
  stopEndingBgm();
  if (el.paused) {
    await el.play();
  }
}

export function pauseBgm(): void {
  menuAudio?.pause();
}

export function resumeBgm(): void {
  if (!unlocked || !menuAudio) {
    return;
  }
  pausePatrolBgm();
  stopEndingBgm();
  void menuAudio.play().catch(() => {
    /* 端末制約で再開できない場合は黙って諦める */
  });
}

export function stopBgm(): void {
  if (!menuAudio) {
    return;
  }
  menuAudio.pause();
  menuAudio.currentTime = 0;
}

/** 見回り中の BGM。メニュー曲を止めて切り替える。 */
export async function playPatrolBgm(options?: { restart?: boolean }): Promise<void> {
  pauseBgm();
  stopEndingBgm();
  const el = getPatrolAudio();
  exposeForTests();
  if (options?.restart !== false) {
    el.currentTime = 0;
  }
  try {
    await el.play();
  } catch {
    /* クリック起点なら通常は通る */
  }
}

export function pausePatrolBgm(): void {
  if (!patrolAudio) {
    return;
  }
  patrolAudio.pause();
}

export function stopPatrolBgm(): void {
  if (!patrolAudio) {
    return;
  }
  patrolAudio.pause();
  patrolAudio.currentTime = 0;
}

/** 「今日もう帰るにゃ」後のエンディング曲。 */
export async function playEndingBgm(): Promise<void> {
  pauseBgm();
  stopPatrolBgm();
  const el = getEndingAudio();
  exposeForTests();
  el.currentTime = 0;
  try {
    await el.play();
  } catch {
    /* クリック起点なら通常は通る */
  }
}

export function stopEndingBgm(): void {
  if (!endingAudio) {
    return;
  }
  endingAudio.pause();
  endingAudio.currentTime = 0;
}

export function isBgmUnlocked(): boolean {
  return unlocked;
}

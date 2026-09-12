import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 猫えらび画面など、みまわり開始前の待ち時間を使って建物モデルの取得・パースを
// 先に済ませておくためのキャッシュ。URLごとに同一の Promise<THREE.Group>（＝同一インスタンス）
// を使い回すことで、PatrolScene マウント時の「3,2,1,スタート」表示中に間に合わなかった分の
// 遅れ（建物がスタート表示の後にポップインする）を減らす。
//
// 重要: ここで返すインスタンスは複数回のみまわり（リプレイ含む）で共有される。
// 呼び出し側は scene への add/remove のみ行い、disposeObject 等でジオメトリ/
// マテリアルを破棄しないこと（破棄すると次回以降そのURLの建物が二度と描画できなくなる）。
const cache = new Map<string, Promise<THREE.Group>>();

function fetchAndParse(url: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

function getOrCreate(url: string): Promise<THREE.Group> {
  const existing = cache.get(url);
  if (existing) {
    return existing;
  }

  const promise = fetchAndParse(url).catch((error: unknown) => {
    // 失敗したURLはキャッシュに残さない。呼び出し側（loadGltf）で再取得を試みられるようにする。
    cache.delete(url);
    throw error;
  });
  cache.set(url, promise);
  return promise;
}

// 先読み専用。結果は待たず、失敗しても呼び出し元には伝えない
// （実際に使う側の loadGltf が同じURLを読んだ際に改めてエラーとして扱う）。
export function preloadGltf(url: string): void {
  getOrCreate(url).catch(() => {
    // 先読み段階のエラーは無視する。
  });
}

// キャッシュ済みなら即座に、なければ新規取得してから返す。
export function loadGltf(url: string): Promise<THREE.Group> {
  return getOrCreate(url);
}

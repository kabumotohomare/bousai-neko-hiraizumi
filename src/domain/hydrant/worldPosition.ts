import { latLngToWorldPosition } from '../../services/transform/latLngToWorldPosition';
import { Hydrant } from './model';

// 一部の消火栓は、行政公開データの緯度経度と、平泉の実データを基にした
// 3D建物モデル(hiraizumi-town.glb)側の数mの位置ズレにより、見た目上
// 建物のメッシュと重なって表示されてしまう(公開データ自体は誤っていない)。
// 実際にゲーム上で建物メッシュへの食い込みを確認できたものだけ、ここで
// 表示・当たり判定上のワールド座標を、実際に食い込みを解消できる向きへ
// 個別に補正する。元データ(public/data/hydrants.json、CSV由来)は変更しない。
//
// 補正値は hiraizumi-town.glb を直接調べ、対象の消火栓の実座標が実際に
// どの建物メッシュへ何m食い込んでいるかを計測した上で決めている。
const HYDRANT_WORLD_OFFSETS_M: Record<string, { dx: number; dz: number }> = {
  // 志羅山3番地の消火栓(タキザワ縄張り、スポーンから「みなみにし70m」)。
  // hiraizumi-town.glb の建物メッシュ(Areas.438)に約2.9m食い込んでいたため、
  // 建物の外に出られる向きへ3.3mずらす(2026-09-12)。
  'hydrant_1-3': { dx: 0, dz: -3.3 },
  // 以下3件は、上記の修正をきっかけに全消火栓を機械的に(hiraizumi-town.glb の
  // 建物メッシュに対する点-in-三角形判定で)一斉点検した際に見つかった、同種の
  // 建物めり込み(2026-09-12時点、いずれも未報告)。各消火栓の周辺メッシュに対して、
  // 最小距離で脱出できる向きを探索し、安全マージン0.4mを加えて算出している。
  'hydrant_1-37': { dx: -0.64, dz: -4.858 }, // 花立54番地20の消火栓 -> Areas.983
  'hydrant_1-46': { dx: -0.397, dz: -0.304 }, // 泉屋25番地1の消火栓 -> Areas.364
  'hydrant_1-53': { dx: 0.459, dz: 1.109 } // 花立166番地2の消火栓 -> Areas.504
};

/**
 * latLngToWorldPosition に、既知の建物めり込みを補正するオフセットを重ねて返す。
 * 表示・territory判定・collider生成など、消火栓のワールド座標を扱う箇所は
 * すべてこの関数を経由すること(latLngToWorldPosition を直接呼ぶと補正が
 * 反映されず、見た目の位置と当たり判定・距離表示がズレる)。
 */
export function hydrantWorldPosition(
  hydrant: Pick<Hydrant, 'id' | 'lat' | 'lng'>,
  origin: { lat: number; lng: number }
): { x: number; z: number } {
  const base = latLngToWorldPosition(hydrant.lat, hydrant.lng, origin);
  const offset = HYDRANT_WORLD_OFFSETS_M[hydrant.id];
  if (!offset) {
    return base;
  }
  return { x: base.x + offset.dx, z: base.z + offset.dz };
}

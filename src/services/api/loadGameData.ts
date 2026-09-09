import { BuildingsSchema } from '../../domain/building/model';
import { CatsSchema } from '../../domain/cat/model';
import { GameConfigSchema } from '../../domain/common/config';
import { MessagesSchema } from '../../domain/common/messages';
import { HydrantsSchema } from '../../domain/hydrant/model';
import { RoadsSchema } from '../../domain/road/model';
import { fetchJson } from './fetchJson';

export async function loadGameData() {
  const [catsRaw, hydrantsRaw, buildingsRaw, roadsRaw, gameConfigRaw, messagesRaw] = await Promise.all([
    fetchJson<unknown>('/data/cats.json'),
    fetchJson<unknown>('/data/hydrants.json'),
    fetchJson<unknown>('/data/buildings.json'),
    fetchJson<unknown>('/data/roads.json'),
    fetchJson<unknown>('/data/game-config.json'),
    fetchJson<unknown>('/data/messages.json')
  ]);

  return {
    cats: CatsSchema.parse(catsRaw),
    hydrants: HydrantsSchema.parse(hydrantsRaw),
    buildings: BuildingsSchema.parse(buildingsRaw),
    roads: RoadsSchema.parse(roadsRaw),
    gameConfig: GameConfigSchema.parse(gameConfigRaw),
    messages: MessagesSchema.parse(messagesRaw)
  };
}

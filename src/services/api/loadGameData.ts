import { CatsSchema } from '../../domain/cat/model';
import { GameConfigSchema } from '../../domain/common/config';
import { MessagesSchema } from '../../domain/common/messages';
import { HydrantsSchema } from '../../domain/hydrant/model';
import { fetchJson } from './fetchJson';

export async function loadGameData() {
  const [catsRaw, hydrantsRaw, gameConfigRaw, messagesRaw] = await Promise.all([
    fetchJson<unknown>('/data/cats.json'),
    fetchJson<unknown>('/data/hydrants.json'),
    fetchJson<unknown>('/data/game-config.json'),
    fetchJson<unknown>('/data/messages.json')
  ]);

  return {
    cats: CatsSchema.parse(catsRaw),
    hydrants: HydrantsSchema.parse(hydrantsRaw),
    gameConfig: GameConfigSchema.parse(gameConfigRaw),
    messages: MessagesSchema.parse(messagesRaw)
  };
}

import { test, assert, near } from './harness.js';
import { loadProgress, saveProgress } from '../storage.js';
import { createGame } from '../game.js';
import { createAudio } from '../audio.js';
function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
test('Сохранение: рекорд и настройки переживают повторную загрузку', () => {
  const storage = memoryStorage();
  assert(saveProgress(storage, { version: 1, best: 7, muted: true, tutorialSeen: true }));
  const loaded = loadProgress(storage);
  assert(loaded.best === 7 && loaded.muted && loaded.tutorialSeen);
});
test('Сохранение: битые данные и недоступное хранилище не блокируют игру', () => {
  for (const value of [
    '{',
    'null',
    '[]',
    '{"version":3,"best":9}',
    '{"version":1,"best":-4,"muted":"yes"}',
    '{"version":1,"best":1e300}',
  ]) {
    const result = loadProgress({ getItem: () => value });
    assert(result.best === 0 && !result.muted);
  }
  const broken = {
    getItem() {
      throw new Error('denied');
    },
    setItem() {
      throw new Error('quota');
    },
  };
  assert(loadProgress(broken).best === 0);
  assert(!saveProgress(broken, { best: 3 }));
});
test('Рекорд: считается серия завершений, повтор позднего этажа сбрасывает серию', () => {
  const game = createGame();
  game.dispatch('start');
  for (let i = 0; i < 3; i++) {
    game.resolveFrame({ key: true, exit: true });
    if (i < 2) game.dispatch('next');
  }
  assert(game.state.floor === 3 && game.state.streak === 3);
  game.dispatch('restart');
  near(game.state.streak, 0);
  game.resolveFrame({ key: true, exit: true });
  near(game.state.streak, 1);
  game.dispatch('next');
  game.resolveFrame({ caught: true });
  near(game.state.streak, 0);
});
test('Звук: отсутствие Web Audio и повторное освобождение безопасны', async () => {
  const audio = createAudio({ Context: null });
  assert((await audio.unlock()) === false);
  audio.play('key');
  audio.update(0.1, { threat: true, walking: true });
  audio.setMuted(true);
  audio.pause();
  audio.dispose();
  audio.dispose();
  assert((await audio.unlock()) === false);
});

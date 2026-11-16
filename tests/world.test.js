import { test,assert,near } from './harness.js';
import { createGame } from '../game.js';
import { createWorld } from '../world.js';
import { parseMap } from '../map.js';
const controls={moveX:0,moveZ:0,aimX:1,aimZ:0};
test('Фонарик: расход, выключение и нулевой заряд ограничены диапазоном',()=>{
  const game=createGame();game.dispatch('start');
  game.drainLight(10,false);assert(game.state.battery<100&&game.state.lightOn);
  const value=game.state.battery;game.dispatch('toggleLight');game.drainLight(10,true);near(game.state.battery,value);
  game.dispatch('toggleLight');game.drainLight(1000,true);near(game.state.battery,0);assert(!game.state.lightOn);
  game.dispatch('toggleLight');assert(!game.state.lightOn);
  game.resolveFrame({battery:1});assert(game.state.battery>0);game.dispatch('toggleLight');assert(game.state.lightOn);
});
test('Фонарик: дополнительный расход включается один раз, пауза не тратит заряд',()=>{
  const a=createGame(),b=createGame();a.dispatch('start');b.dispatch('start');
  a.drainLight(1,false);b.drainLight(1,true);assert(b.state.battery<a.state.battery);
  b.dispatch('pause');const value=b.state.battery;b.drainLight(100,true);near(b.state.battery,value);
  b.dispatch('restart');near(b.state.battery,100);assert(b.state.lightOn);
});
test('Мир: батарейка подбирается один раз, повтор восстанавливает её',()=>{
  const map=parseMap(['#######','#P.BKD#','#.....#','#######']);
  const world=createWorld(map),game=createGame();game.dispatch('start');game.drainLight(40,false);
  world.position.x=4.5;world.position.z=1.5;
  world.step(.05,controls,game);const value=game.state.battery;
  assert(world.collected.size===1);world.step(.05,controls,game);assert(game.state.battery<value);
  game.dispatch('pause');game.dispatch('restart');world.reset();
  assert(world.collected.size===0);near(world.position.x,1.5);
});
test('Мир: запертый выход не завершается, ключ и выход работают через реальный шаг',()=>{
  const map=parseMap(['#######','#P.K.D#','#.....#','#######']);
  const world=createWorld(map),game=createGame();game.dispatch('start');
  world.position.x=7.5;world.step(.05,controls,game);assert(game.state.phase==='playing');
  world.position.x=4.5;world.step(.05,controls,game);assert(game.state.hasKey);
  world.position.x=7.5;world.step(.05,controls,game);assert(game.state.phase==='floorComplete');
});
test('Мир: контакт с врагом даёт поражение до подбора ключа',()=>{
  const map=parseMap(['#######','#P.K.D#','#.....#','#######']);
  map.enemies=[{x:4.5,z:1.5,patrol:[{x:4.5,z:1.5}]}];
  const world=createWorld(map),game=createGame();game.dispatch('start');world.position.x=4.5;
  world.step(.05,controls,game);assert(game.state.phase==='gameOver'&&!game.state.hasKey);
});

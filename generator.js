import { parseMap,FLOOR_TEMPLATE,CELL_SIZE } from './map.js';
import { cellIndex,cellPoint,distancesFrom,findPath } from './navigation.js';

// Every template preserves the central cross and its four possible doorway ports.
export const ROOM_TEMPLATES=[
  {name:'Зал',pillars:[]},
  {name:'Крипта',pillars:[[2,2],[4,2],[2,4],[4,4]]},
  {name:'Архив',pillars:[[1,2],[2,2],[4,4],[5,4]]},
  {name:'Часовня',pillars:[[2,1],[4,1],[2,5],[4,5]]},
  {name:'Колодец',pillars:[[2,2],[4,2]]},
  {name:'Галерея',pillars:[[2,1],[2,2],[4,4],[4,5]]},
  {name:'Склеп',pillars:[[1,4],[2,4],[4,2],[5,2]]},
  {name:'Караульная',pillars:[[2,2],[2,4],[4,4]]},
].map(template=>({...template,rows:Array.from({length:7},(_,z)=>Array.from({length:7},(_,x)=>
  x===0||z===0||x===6||z===6||template.pillars.some(p=>p[0]===x&&p[1]===z)?'#':'.').join('')),
  ports:{north:[3,0],east:[6,3],south:[3,6],west:[0,3]}}));

export function createRandom(seed) {
  let state=seed>>>0;
  return ()=>{state=(state+0x6D2B79F5)>>>0;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};
}

function buildCandidate(seed,floor,roomTemplates,difficulty,attempt) {
  if(!roomTemplates.length) return null;
  const random=createRandom((seed^Math.imul(floor,0x9e3779b1)^Math.imul(attempt+1,0x85ebca6b))>>>0);
  const pick=array=>array[Math.floor(random()*array.length)];
  const count=Math.max(4,Math.min(8,Math.floor(difficulty.roomCount??4)));
  const rooms=[],connections=[],sites=new Set();
  const rootSite=Math.floor(random()*9);
  function add(site,parent){
    const template=pick(roomTemplates);
    if(!template?.rows||template.rows.length!==7||template.rows.some(row=>row.length!==7)) throw new Error('Неверный шаблон комнаты');
    const id=rooms.length,room={id,site,parent,branch:parent===null?-1:parent===0?id:rooms[parent].branch,
      originX:1+(site%3)*9,originZ:1+Math.floor(site/3)*9,template:template.name,rows:template.rows};
    rooms.push(room);sites.add(site);return room;
  }
  add(rootSite,null);
  while(rooms.length<count){
    const frontier=[];
    for(const room of rooms){const x=room.site%3,z=Math.floor(room.site/3);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=x+dx,nz=z+dz,site=nz*3+nx;
        if(nx>=0&&nx<3&&nz>=0&&nz<3&&!sites.has(site)) frontier.push({site,parent:room.id});
      }
    }
    const edge=pick(frontier);add(edge.site,edge.parent);
  }
  const grid=Array.from({length:29},()=>Array(29).fill('#'));
  for(const room of rooms) for(let z=0;z<7;z++) for(let x=0;x<7;x++) grid[room.originZ+z][room.originX+x]=room.rows[z][x];
  for(const room of rooms.slice(1)){
    const parent=rooms[room.parent],cells=[];
    const ax=parent.originX+3,az=parent.originZ+3,bx=room.originX+3,bz=room.originZ+3;
    const dx=Math.sign(bx-ax),dz=Math.sign(bz-az),length=Math.abs(bx-ax)+Math.abs(bz-az);
    for(let t=0;t<=length;t++){const x=ax+dx*t,z=az+dz*t;grid[z][x]='.';cells.push({x:x*CELL_SIZE,z:z*CELL_SIZE});}
    connections.push({from:parent.id,to:room.id,cells});
  }
  const start={x:(rooms[0].originX+3)*CELL_SIZE,z:(rooms[0].originZ+3)*CELL_SIZE};
  grid[start.z/CELL_SIZE][start.x/CELL_SIZE]='P';
  const map=parseMap(grid.map(row=>row.join(''))),distances=distancesFrom(start,map);
  function roomFarthest(room){let best=-1,distance=-1;
    for(let z=room.originZ+1;z<room.originZ+6;z++)for(let x=room.originX+1;x<room.originX+6;x++){
      const index=z*map.width+x;if(map.walkable[index]&&distances[index]>distance){distance=distances[index];best=index;}
    }
    return {room,index:best,distance};
  }
  const ranked=rooms.slice(1).map(roomFarthest).sort((a,b)=>b.distance-a.distance);
  const keyRoom=ranked[0].room,key=cellPoint(ranked[0].index,map);
  const otherBranch=ranked.filter(item=>item.room.id!==keyRoom.id&&item.room.branch!==keyRoom.branch);
  const candidates=otherBranch.length?otherBranch:ranked.filter(item=>item.room.id!==keyRoom.id);
  const exitRoom=(candidates[0]??{room:rooms[0]}).room;
  const exit={x:(exitRoom.originX+1)*CELL_SIZE,z:(exitRoom.originZ+5)*CELL_SIZE};
  map.spawns.key=key;map.spawns.exit=exit;
  const used=new Set([cellIndex(start,map),cellIndex(key,map),cellIndex(exit,map)]);
  const enemies=[];
  const eligible=ranked.filter(item=>distances[cellIndex({x:(item.room.originX+3)*CELL_SIZE,z:(item.room.originZ+3)*CELL_SIZE},map)]>=8);
  for(const item of eligible){
    if(enemies.length>=Math.max(0,Math.min(4,difficulty.enemyCount??1)))break;
    const point={x:(item.room.originX+3)*CELL_SIZE,z:(item.room.originZ+3)*CELL_SIZE};
    const index=cellIndex(point,map);if(used.has(index))continue;
    enemies.push(point);used.add(index);
  }
  const batteries=[];
  const route=[...findPath(start,key,map),...findPath(key,exit,map).slice(1)];
  for(let i=8;i<route.length;i+=12){const point=route[i],index=cellIndex(point,map);if(!used.has(index)){batteries.push({id:batteries.length,...point});used.add(index);}}
  // Room supplies remain useful when the player takes another branch.
  for(const room of rooms){if(room.id%(difficulty.supplyEveryRooms??1)!==0)continue;const point={x:(room.originX+5)*CELL_SIZE,z:(room.originZ+1)*CELL_SIZE},index=cellIndex(point,map);
    if(!used.has(index)&&map.walkable[index]){batteries.push({id:batteries.length,...point});used.add(index);}}
  return {...map,batteries,enemies,rooms,connections,seed:seed>>>0,floor,attempts:attempt+1,fallback:false,
    enemyOptions:difficulty.enemyOptions??{},keyRoom:keyRoom.id,exitRoom:exitRoom.id};
}

export function validateFloor(map) {
  const errors=[];
  if(!map||!Number.isInteger(map.width)||!Number.isInteger(map.height)||map.width<3||map.height<3||
    !map.walkable||map.walkable.length!==map.width*map.height||!Array.isArray(map.walls))return {valid:false,errors:['Неверная сетка']};
  const points=[map.spawns?.player,map.spawns?.key,map.spawns?.exit,...(map.batteries??[]),...(map.enemies??[])];
  const used=new Set();
  for(const point of points){
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z)){errors.push('Отсутствует цель/позиция');continue;}
    const index=cellIndex(point,map);
    if(!map.walkable[index])errors.push('Объект вне пола');
    if(used.has(index))errors.push('Пересечение объектов');used.add(index);
  }
  if(map.spawns?.player){const distances=distancesFrom(map.spawns.player,map);
    for(let i=0;i<map.walkable.length;i++)if(map.walkable[i]&&distances[i]<0){errors.push('Несвязный пол');break;}
    for(const enemy of map.enemies??[])if(distances[cellIndex(enemy,map)]<8)errors.push('Небезопасный старт');
  }
  return {valid:errors.length===0,errors};
}

export function generateFloor({seed=1,floor=1,roomTemplates=ROOM_TEMPLATES,difficulty={roomCount:4,enemyCount:1}}={}) {
  seed=Number(seed)>>>0;floor=Number.isFinite(floor)?Math.max(1,Math.floor(floor)):1;
  for(let attempt=0;attempt<20;attempt++){
    try{const candidate=buildCandidate(seed,floor,roomTemplates,difficulty,attempt);if(candidate&&validateFloor(candidate).valid)return candidate;}
    catch{ /* Invalid content cannot trap generation in an unbounded loop. */ }
  }
  const fallback={...parseMap(FLOOR_TEMPLATE),seed,floor,rooms:[],connections:[],attempts:20,fallback:true,enemyOptions:difficulty.enemyOptions??{}};
  if(!validateFloor(fallback).valid)throw new Error('Резервная карта не прошла проверку');
  return fallback;
}

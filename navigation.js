import { CELL_SIZE } from './map.js';

export function inCone(origin, direction, target, range, cosine) {
  const x=target.x-origin.x,z=target.z-origin.z;
  const distance=Math.hypot(x,z),length=Math.hypot(direction.x,direction.z);
  if (distance > range) return false;
  if (distance < 1e-8) return true;
  return length > 0 && (x*direction.x+z*direction.z)/(distance*length) >= cosine;
}

export function hasLineOfSight(from, to, map) {
  const dx=to.x-from.x,dz=to.z-from.z;
  for(const wall of map.walls) {
    let enter=0,leave=1;
    if(Math.abs(dx)<1e-10) { if(from.x<wall.minX||from.x>wall.maxX) continue; }
    else {
      const a=(wall.minX-from.x)/dx,b=(wall.maxX-from.x)/dx;
      enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
    }
    if(Math.abs(dz)<1e-10) { if(from.z<wall.minZ||from.z>wall.maxZ) continue; }
    else {
      const a=(wall.minZ-from.z)/dz,b=(wall.maxZ-from.z)/dz;
      enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
    }
    if(enter<=leave) return false;
  }
  return true;
}

export function cellIndex(point, map) {
  const x=Math.round(point.x/CELL_SIZE),z=Math.round(point.z/CELL_SIZE);
  if(x<0||z<0||x>=map.width||z>=map.height) return -1;
  return z*map.width+x;
}
export function cellPoint(index, map) { return {x:(index%map.width)*CELL_SIZE,z:Math.floor(index/map.width)*CELL_SIZE}; }
export function neighbours(index, map) {
  const x=index%map.width,z=Math.floor(index/map.width),result=[];
  if(x>0&&map.walkable[index-1]) result.push(index-1);
  if(x<map.width-1&&map.walkable[index+1]) result.push(index+1);
  if(z>0&&map.walkable[index-map.width]) result.push(index-map.width);
  if(z<map.height-1&&map.walkable[index+map.width]) result.push(index+map.width);
  return result;
}
export function distancesFrom(start, map) {
  const result=new Int32Array(map.width*map.height).fill(-1);
  const index=typeof start==='number'?start:cellIndex(start,map);
  if(!map.walkable[index]) return result;
  const queue=[index];result[index]=0;
  for(let i=0;i<queue.length;i++) for(const next of neighbours(queue[i],map)) {
    if(result[next]!==-1) continue;
    result[next]=result[queue[i]]+1;queue.push(next);
  }
  return result;
}
export function findPath(start, goal, map) {
  const first=cellIndex(start,map),last=cellIndex(goal,map);
  if(!map.walkable[first]||!map.walkable[last]) return [];
  const previous=new Int32Array(map.walkable.length).fill(-1),queue=[first];previous[first]=first;
  for(let i=0;i<queue.length&&previous[last]===-1;i++) for(const next of neighbours(queue[i],map)) {
    if(previous[next]!==-1) continue;
    previous[next]=queue[i];queue.push(next);
  }
  if(previous[last]===-1) return [];
  const path=[];
  for(let index=last;;index=previous[index]) { path.push(cellPoint(index,map));if(index===first) break; }
  return path.reverse();
}

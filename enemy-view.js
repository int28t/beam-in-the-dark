import * as THREE from 'three';

export function createEnemyView() {
  const root=new THREE.Group();
  const geometries=[new THREE.ConeGeometry(.36,1.15,7),new THREE.SphereGeometry(.23,8,6),new THREE.SphereGeometry(.044,6,4)];
  const shadow=new THREE.MeshStandardMaterial({color:0x101322,roughness:1});
  const eyes=new THREE.MeshBasicMaterial({color:0xf78d77});
  const body=new THREE.Group();root.add(body);
  const cloak=new THREE.Mesh(geometries[0],shadow);cloak.position.y=.6;cloak.castShadow=true;body.add(cloak);
  const head=new THREE.Mesh(geometries[1],shadow);head.position.y=1.1;head.castShadow=true;body.add(head);
  for(const x of [-.08,.08]){const eye=new THREE.Mesh(geometries[2],eyes);eye.position.set(x,1.12,-.215);body.add(eye);}
  return {root,update(enemy,time){root.position.set(enemy.position.x,Math.sin(time*3)*.025,enemy.position.z);
    body.rotation.y=Math.atan2(-enemy.aim.x,-enemy.aim.z);eyes.color.setHex(enemy.illuminated?0xffdbad:0xf78d77);},
    dispose(){root.removeFromParent();geometries.forEach(g=>g.dispose());shadow.dispose();eyes.dispose();}};
}

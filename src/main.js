import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { generateSphere, theoreticalCounts } from './geometry.js';
import { generateStalbergLayer } from './stalberg.js';
import './style.css';

const canvas=document.querySelector('#viewport');
const devlog=document.querySelector('#devlog');
document.querySelector('#open-devlog').addEventListener('click',()=>devlog.showModal());
devlog.addEventListener('click',event=>{if(event.target===devlog)devlog.close();});
if(location.hash==='#devlog')devlog.showModal();
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true}); renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.1,100); camera.position.set(0.2,1.1,4.1);
const orbit=new OrbitControls(camera,canvas); orbit.enableDamping=true; orbit.minDistance=2.1; orbit.maxDistance=8;
scene.add(new THREE.HemisphereLight(0xbceee6,0x13202d,2.2)); const key=new THREE.DirectionalLight(0xffffff,2.8); key.position.set(3,4,5); scene.add(key);

const state={bands:6,detail:0,patchRings:4,seed:2026,dissolveProbability:.38,organic:.22,relaxIterations:8,relaxStrength:.24,patchRelaxIterations:12,patchRelaxStrength:.42,polarEpsilon:.18,radius:1.25,gap:0,edgeOpacity:.42,fillOpacity:.86,showCells:false,showEdges:true,showMicroGrid:true,showPrimal:false,showDissolves:false,showDefects:true,autoRotate:false};
let world=new THREE.Group(), model, microLayer, selected=null, rebuildTimer;
scene.add(world);

const config=[
  ['GRID DENSITY',[['bands','Macro bands',3,12,1],['patchRings','Micro-grid rings',1,7,1]]],
  ['STÅLBERG CUTTING',[['seed','Random seed',1,99999,1],['dissolveProbability','Triangle dissolve',0,1,.01],['organic','Macro irregularity',0,1,.01],['relaxIterations','Macro relax passes',0,30,1],['relaxStrength','Macro relax strength',0,.65,.01],['patchRelaxIterations','Patch relax passes',0,30,1],['patchRelaxStrength','Patch relax strength',0,.7,.01],['polarEpsilon','Polar convergence',.02,.35,.01]]],
  ['SURFACE',[['gap','Cell inset',0,.06,.001],['edgeOpacity','Border opacity',0,1,.01],['fillOpacity','Fill opacity',.2,1,.01]]]
];
const controls=document.querySelector('#controls'); controls.innerHTML='<div class="panel-title">GENERATION CONTROLS</div>';
for(const [title,fields] of config){ const section=document.createElement('div'); section.className='control-section'; section.innerHTML=`<h3>${title}</h3>`; for(const [key,label,min,max,step,format] of fields){ const row=document.createElement('div'); row.className='field'; row.innerHTML=`<label>${label}</label><output></output><input type="range" min="${min}" max="${max}" step="${step}" value="${state[key]}">`; const input=row.querySelector('input'),output=row.querySelector('output'); const show=()=>output.textContent=format?format(+input.value):(+input.value).toFixed(step<.01?3:step<1?2:0); show(); input.oninput=()=>{state[key]=+input.value;show(); clearTimeout(rebuildTimer); rebuildTimer=setTimeout(rebuild, key==='edgeOpacity'||key==='fillOpacity'?30:120);}; section.append(row); } controls.append(section); }
const view=document.createElement('div'); view.className='control-section'; view.innerHTML='<h3>VIEW LAYERS</h3>';
for(const [key,label] of [['showCells','Macro cell fill'],['showEdges','Macro borders'],['showMicroGrid','Stålberg micro-grid'],['showPrimal','Triangle bands'],['showDissolves','Dissolved pairs'],['showDefects','6 + 6 pole crowns'],['autoRotate','Auto rotate']]){ const row=document.createElement('label'); row.className='toggle'; row.innerHTML=`<span>${label}</span><input type="checkbox" ${state[key]?'checked':''}>`; row.querySelector('input').onchange=e=>{state[key]=e.target.checked; if(key==='autoRotate') orbit.autoRotate=state[key]; else rebuild();}; view.append(row); }
const buttons=document.createElement('div'); buttons.className='button-row'; buttons.innerHTML='<button id="regenerate">REGENERATE</button><button id="reset">RESET VIEW</button>'; view.append(buttons); controls.append(view);
buttons.querySelector('#regenerate').onclick=rebuild; buttons.querySelector('#reset').onclick=()=>{camera.position.set(.2,1.1,4.1);orbit.target.set(0,0,0);orbit.update();};

function dispose(group){ group.traverse(o=>{o.geometry?.dispose(); if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();}); scene.remove(group); }
function insetPolygon(cell){ return cell.polygon.map(p=>p.clone().lerp(cell.center,state.gap)); }
function rebuild(){
  model=generateSphere(state); dispose(world); world=new THREE.Group(); scene.add(world); selected=null;
  microLayer=generateStalbergLayer(model,state);
  const rayTargets=[];
  world.add(new THREE.Mesh(new THREE.SphereGeometry(state.radius*.997,72,48),new THREE.MeshStandardMaterial({color:0x26363a,roughness:.92,metalness:.03})));
  for(const cell of model.cells){ const poly=insetPolygon(cell), positions=[]; for(let i=0;i<poly.length;i++) positions.push(...cell.center.toArray(),...poly[i].toArray(),...poly[(i+1)%poly.length].toArray()); const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geo.computeVertexNormals(); const defect=cell.sides!==6&&state.showDefects; const color=defect?(cell.pole==='north'?0xe4a65f:0x679bd1):new THREE.Color().setHSL(.46+((cell.id*17)%19)/600,.18,.38+((cell.id*13)%11)/500); const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:.82,metalness:.08,transparent:!state.showCells||state.fillOpacity<1,opacity:state.showCells?state.fillOpacity:0,depthWrite:state.showCells,side:THREE.DoubleSide})); mesh.userData.cell=cell; world.add(mesh); rayTargets.push(mesh); }
  if(state.showEdges){ const pts=[]; for(const cell of model.cells){ const p=insetPolygon(cell); for(let i=0;i<p.length;i++)pts.push(p[i],p[(i+1)%p.length]); } const geo=new THREE.BufferGeometry().setFromPoints(pts); world.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x07100f,transparent:true,opacity:state.edgeOpacity}))); }
  if(state.showPrimal){ const pts=[]; for(const [a,b,c] of model.faces) pts.push(model.vertices[a].clone().multiplyScalar(1.258),model.vertices[b].clone().multiplyScalar(1.258),model.vertices[b].clone().multiplyScalar(1.258),model.vertices[c].clone().multiplyScalar(1.258),model.vertices[c].clone().multiplyScalar(1.258),model.vertices[a].clone().multiplyScalar(1.258)); world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0x65e6d4,transparent:true,opacity:.32}))); }
  if(state.showDissolves&&model.dissolveEdges.length){ const pts=model.dissolveEdges.flat(); world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:0xffc56b,transparent:true,opacity:.9}))); }
  if(state.showMicroGrid&&microLayer.segments.length){world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(microLayer.segments),new THREE.LineBasicMaterial({color:0xa718ff,transparent:true,opacity:.92})));}
  if(state.showDefects){
    const crownPoints=[],capPoints=[];
    for(const patch of microLayer.patches){const target=patch.isPolar?crownPoints:patch.isPoleCap?capPoints:null;if(!target)continue;for(const q of patch.quads)for(let i=0;i<4;i++)target.push(patch.vertices[q[i]].clone().multiplyScalar(1.003),patch.vertices[q[(i+1)%4]].clone().multiplyScalar(1.003));}
    if(crownPoints.length)world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(crownPoints),new THREE.LineBasicMaterial({color:0xffaa45,transparent:true,opacity:1})));
    if(capPoints.length)world.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(capPoints),new THREE.LineBasicMaterial({color:0x68e1cf,transparent:true,opacity:1})));
  }
  world.userData.rayTargets=rayTargets; updateStats(); document.querySelector('#inspector').innerHTML='<div class="panel-title">CELL INSPECTOR</div><p>Click a cell to inspect its topology.</p>';
}

function updateStats(){ const s=model.stats,m=microLayer.stats,v=model.validation; document.querySelector('#stats-grid').innerHTML=[['Macro cells',s.cells.toLocaleString()],['Macro hexagons',s.hexagons.toLocaleString()],['Pentagons',s.defects],['North / South',`${s.north} / ${s.south}`],['Pole caps','2 × degree 6'],['Micro patches',m.patches.toLocaleString()],['Polar adapters',m.polarAdapters],['Patch triangles',m.trianglesBefore.toLocaleString()],['Dissolved pairs',m.dissolvedPairs.toLocaleString()],['Final micro quads',m.quads.toLocaleString()],['Shared samples',`${m.sharedBoundarySamples} + ${m.sharedSubdivisionSamples}`],['Euler V−E+F',v.euler]].map(x=>`<span>${x[0]}</span><span>${x[1]}</span>`).join(''); const crowns=model.cells.filter(c=>c.pole&&c.sides===5&&c.neighbors.length===5).length;const ok=v.euler===2&&v.boundaryEdges===0&&s.defects===12&&s.north===6&&s.south===6&&crowns===12&&m.polarAdapters===12; const el=document.querySelector('#validity'); el.className=`validity ${ok?'':'bad'}`; el.textContent=ok?'● 3 LAYERS / 12 PENTAGONS VALID':'● TOPOLOGY CHECK FAILED'; }

const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2(); canvas.addEventListener('pointerdown',e=>{ if(e.button!==0)return; mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1); raycaster.setFromCamera(mouse,camera); const hit=raycaster.intersectObjects(world.userData.rayTargets||[],false)[0]; if(!hit)return; const c=hit.object.userData.cell,kind=c.isPoleCap?'EPSILON POLE CAP':c.sides===5?'CROWN PENTAGON':'ORDINARY HEXAGON'; document.querySelector('#inspector').innerHTML=`<div class="panel-title">CELL ${c.id}</div><p>SIDES / NEIGHBORS&nbsp; ${c.sides} / ${c.neighbors.length}<br>CLASS&nbsp; ${kind}<br>CROWN&nbsp; ${(c.pole||'none').toUpperCase()}<br>ADJACENT&nbsp; ${c.neighbors.join(', ')}</p>`; });
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
rebuild();
renderer.setAnimationLoop(()=>{orbit.autoRotate=state.autoRotate;orbit.autoRotateSpeed=.45;orbit.update();renderer.render(scene,camera);});

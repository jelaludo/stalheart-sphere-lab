import assert from 'node:assert/strict';
import { generateSphere } from '../src/geometry.js';
import { generateStalbergLayer } from '../src/stalberg.js';

let cases=0;
for(const bands of [3,6,12])for(const detail of [0])for(const patchRings of [1,2,3,5])for(const seed of [1,2026]){
  const options={bands,detail,patchRings,seed,dissolveProbability:.42,organic:.3,relaxIterations:2,relaxStrength:.3,patchRelaxIterations:2,patchRelaxStrength:.4,polarEpsilon:.1,radius:1.25};
  const macro=generateSphere(options),micro=generateStalbergLayer(macro,options);
  assert.equal(macro.validation.euler,2,'sphere Euler characteristic');
  assert.equal(macro.validation.boundaryEdges,0,'no macro boundary edges');
  assert.equal(macro.stats.defects,12,'exact defect budget');
  assert.equal(macro.stats.north,6,'north crown');
  assert.equal(macro.stats.south,6,'south crown');
  assert.equal(macro.cells.filter(c=>c.pole&&c.sides===5&&c.neighbors.length===5).length,12,'all crown cells are genuine degree-five pentagons');
  assert.equal(macro.cells.filter(c=>c.isPoleCap&&c.sides===6).length,2,'two non-degenerate degree-six epsilon caps');
  assert.ok(macro.cells.filter(c=>!c.pole).every(c=>c.sides===6&&c.neighbors.length===6),'every non-crown cell is degree six');
  assert.equal(micro.stats.patches,macro.stats.cells,'one patch per macro-cell');
  assert.equal(micro.stats.polarAdapters,12,'one adapter per defect');
  assert.equal(micro.stats.sharedBoundarySamples,macro.validation.V+macro.validation.E*(patchRings-1),'canonical corners and edge samples');
  assert.ok(micro.quads.length>0,'subdivision generated quads');
  assert.equal(micro.stats.quads,micro.stats.trianglesAfter*3+micro.stats.dissolvedPairs*4,'triangle and quad subdivision accounting');
  assert.ok([...micro.sharedSubdivisionBoundary.values()].every(v=>v._boundaryKey?.startsWith('mid:')),'subdivided border vertices are globally canonical');
  assert.ok(micro.quads.flat().every(v=>[v.x,v.y,v.z].every(Number.isFinite)),'finite micro-grid coordinates');
  const objectIds=new WeakMap();let nextId=0;const id=v=>{if(!objectIds.has(v))objectIds.set(v,nextId++);return objectIds.get(v);},microEdges=new Map();
  for(const q of micro.quads){
    assert.ok(q.every((v,i)=>v.distanceTo(q[(i+1)%4])>1e-8),'no zero-length quad edges');
    for(let i=0;i<4;i++){const a=id(q[i]),b=id(q[(i+1)%4]),key=a<b?`${a}:${b}`:`${b}:${a}`;microEdges.set(key,(microEdges.get(key)||0)+1);}
  }
  assert.ok([...microEdges.values()].every(count=>count===2),'every micro-grid edge has exactly two incident quads');
  assert.equal(nextId-microEdges.size+micro.quads.length,2,'micro-grid Euler characteristic');
  const repeat=generateStalbergLayer(generateSphere(options),options);
  assert.deepEqual(repeat.stats,micro.stats,'seeded generation is deterministic');
  cases++;
}
console.log(`Validated ${cases} macro/micro-grid configurations.`);

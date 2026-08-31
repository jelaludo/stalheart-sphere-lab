import * as THREE from 'three';

function rng(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;

// Six wrapped triangular bands capped by ordinary degree-six pole vertices.
// The first and last collars contain the sphere's twelve degree-five defects.
function crownSeed(bands){
  const vertices=[new THREE.Vector3(0,1,0)];
  for(let row=0;row<bands;row++){
    const z=1-2*(row+1)/(bands+1), r=Math.sqrt(1-z*z), phase=(row&1)*Math.PI/6;
    for(let col=0;col<6;col++){const a=phase+col*Math.PI/3;vertices.push(new THREE.Vector3(r*Math.cos(a),z,r*Math.sin(a)));}
  }
  const south=vertices.length;vertices.push(new THREE.Vector3(0,-1,0));const faces=[];
  for(let c=0;c<6;c++)faces.push([0,1+c,1+(c+1)%6]);
  for(let row=0;row<bands-1;row++)for(let c=0;c<6;c++){
    const a=1+row*6+c,b=1+row*6+(c+1)%6,d=1+(row+1)*6+c,e=1+(row+1)*6+(c+1)%6;
    if(row&1)faces.push([a,d,b],[b,d,e]);else faces.push([a,d,e],[a,e,b]);
  }
  const last=1+(bands-1)*6;for(let c=0;c<6;c++)faces.push([south,last+(c+1)%6,last+c]);
  orient(vertices,faces);return{vertices,faces};
}
function orient(v,faces){for(const f of faces){const n=new THREE.Vector3().crossVectors(v[f[1]].clone().sub(v[f[0]]),v[f[2]].clone().sub(v[f[0]]));if(n.dot(v[f[0]])<0)[f[1],f[2]]=[f[2],f[1]];}}
function subdivide(vertices,faces,levels){
  for(let l=0;l<levels;l++){
    const mids=new Map(),mid=(a,b)=>{const k=edgeKey(a,b);if(mids.has(k))return mids.get(k);const i=vertices.length;vertices.push(vertices[a].clone().add(vertices[b]).normalize());mids.set(k,i);return i;},next=[];
    for(const[a,b,c]of faces){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}faces=next;orient(vertices,faces);
  }return faces;
}
function pairTriangles(faces,probability,random,protectedVertices){
  const lookup=new Map();faces.forEach((f,fi)=>[[f[0],f[1]],[f[1],f[2]],[f[2],f[0]]].forEach(([a,b])=>{const k=edgeKey(a,b);if(!lookup.has(k))lookup.set(k,[]);lookup.get(k).push(fi);}));
  const candidates=[...lookup.entries()].filter(([,x])=>x.length===2).sort(()=>random()-.5),used=new Set(),pairs=[];
  for(const[k,[a,b]]of candidates){if(used.has(a)||used.has(b)||random()>probability)continue;const edge=k.split(':').map(Number);if(edge.some(v=>protectedVertices.has(v)))continue;used.add(a);used.add(b);pairs.push({faces:[a,b],edge});}
  return{pairs,remainingTriangles:faces.length-used.size};
}
function topology(vertices,faces){const adjacency=Array.from({length:vertices.length},()=>new Set()),inc=Array.from({length:vertices.length},()=>[]),edges=new Map();faces.forEach((f,fi)=>{f.forEach(v=>inc[v].push(fi));for(const[a,b]of[[f[0],f[1]],[f[1],f[2]],[f[2],f[0]]]){adjacency[a].add(b);adjacency[b].add(a);const k=edgeKey(a,b);edges.set(k,(edges.get(k)||0)+1);}});return{adjacency,inc,edges};}
function orderedFaceRing(vertexId,incident,faces,centers,center){
  const around=new Map(incident.map(fi=>[fi,[]]));
  const edgeFaces=new Map();
  for(const fi of incident)for(const other of faces[fi])if(other!==vertexId){if(!edgeFaces.has(other))edgeFaces.set(other,[]);edgeFaces.get(other).push(fi);}
  for(const owners of edgeFaces.values())if(owners.length===2){around.get(owners[0]).push(owners[1]);around.get(owners[1]).push(owners[0]);}
  const ordered=[],start=incident[0];let previous=-1,current=start;
  do{ordered.push(current);const next=around.get(current).find(fi=>fi!==previous);previous=current;current=next;}while(current!==start&&current!==undefined&&ordered.length<=incident.length);
  if(ordered.length!==incident.length)return incident;
  if(ordered.length>=3){const a=centers[ordered[0]],b=centers[ordered[1]],c=centers[ordered[2]],normal=new THREE.Vector3().crossVectors(b.clone().sub(a),c.clone().sub(a));if(normal.dot(center)<0)ordered.reverse();}
  return ordered;
}

export function generateSphere(o){
  const base=crownSeed(o.bands),baseVertexCount=base.vertices.length;
  const protectedVertices=new Set([0,baseVertexCount-1,...Array.from({length:6},(_,i)=>i+1),...Array.from({length:6},(_,i)=>baseVertexCount-7+i)]);
  const basePairing=pairTriangles(base.faces,o.dissolveProbability,rng(o.seed|0),protectedVertices);
  const vertices=base.vertices.map(v=>v.clone()),faces=subdivide(vertices,base.faces.map(f=>[...f]),o.detail);
  const {adjacency,inc,edges}=topology(vertices,faces),random=rng((o.seed|0)^0x51a7);
  for(let i=0;i<vertices.length;i++){
    if(protectedVertices.has(i))continue;const p=vertices[i],axis=new THREE.Vector3(random()-.5,random()-.5,random()-.5);axis.addScaledVector(p,-axis.dot(p)).normalize();
    const pairBias=basePairing.pairs.length?0.8+0.4*Math.sin(i*1.618+o.seed):1;p.addScaledVector(axis,(random()-.5)*o.organic*.15*pairBias).normalize();
  }
  for(let pass=0;pass<o.relaxIterations;pass++){
    const next=vertices.map((p,i)=>{if(protectedVertices.has(i))return p.clone();const avg=new THREE.Vector3();adjacency[i].forEach(n=>avg.add(vertices[n]));avg.multiplyScalar(1/adjacency[i].size);const d=avg.sub(p);d.addScaledVector(p,-d.dot(p));return p.clone().addScaledVector(d,o.relaxStrength).normalize();});vertices.splice(0,vertices.length,...next);
  }
  const southId=baseVertexCount-1;
  const centers=faces.map(([a,b,c])=>{
    const center=vertices[a].clone().add(vertices[b]).add(vertices[c]).normalize();
    if(a===0||b===0||c===0)center.lerp(new THREE.Vector3(0,1,0),1-o.polarEpsilon).normalize();
    if(a===southId||b===southId||c===southId)center.lerp(new THREE.Vector3(0,-1,0),1-o.polarEpsilon).normalize();
    return center.multiplyScalar(o.radius);
  });
  const cells=vertices.map((p,id)=>{const center=p.clone().multiplyScalar(o.radius),polygonPointIds=orderedFaceRing(id,inc[id],faces,centers,center),polygon=polygonPointIds.map(fi=>centers[fi]);let pole=null;if(id>=1&&id<=6)pole='north';if(id>=baseVertexCount-7&&id<baseVertexCount-1)pole='south';return{id,center,polygon,polygonPointIds,sides:adjacency[id].size,neighbors:[...adjacency[id]],pole,isPoleCap:id===0||id===southId};});
  const defectCells=cells.filter(c=>c.sides!==6),boundary=[...edges.values()].filter(n=>n!==2).length;
  const dissolveEdges=basePairing.pairs.map(p=>p.edge.map(i=>base.vertices[i].clone().multiplyScalar(o.radius*1.006)));
  const visibleEdges=new Map(),visibleVertices=new Set();for(const cell of cells)for(let i=0;i<cell.polygonPointIds.length;i++){const a=cell.polygonPointIds[i],b=cell.polygonPointIds[(i+1)%cell.polygonPointIds.length];visibleVertices.add(a);visibleVertices.add(b);const k=edgeKey(a,b);visibleEdges.set(k,(visibleEdges.get(k)||0)+1);}
  const visibleBoundaryEdges=[...visibleEdges.values()].filter(n=>n!==2).length,visibleEuler=visibleVertices.size-visibleEdges.size+cells.length;
  return{vertices,faces,cells,dissolveEdges,validation:{V:visibleVertices.size,E:visibleEdges.size,F:cells.length,euler:visibleEuler,boundaryEdges:visibleBoundaryEdges,sourceEuler:vertices.length-edges.size+faces.length},stats:{cells:cells.length,hexagons:cells.filter(c=>c.sides===6).length,defects:defectCells.length,north:defectCells.filter(c=>c.pole==='north').length,south:defectCells.filter(c=>c.pole==='south').length,triangles:faces.length,edges:visibleEdges.size,baseTriangles:base.faces.length,dissolvedPairs:basePairing.pairs.length,remainingTriangles:basePairing.remainingTriangles,generatedQuads:basePairing.pairs.length*4+basePairing.remainingTriangles*3}};
}
export function theoreticalCounts(bands,detail){const V0=6*bands+2,E0=18*bands,F0=12*bands,m=(4**detail-1)/3,cells=V0+E0*m;return{cells,hexagons:cells-12,triangles:F0*4**detail};}

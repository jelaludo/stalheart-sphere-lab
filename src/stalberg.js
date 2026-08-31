import * as THREE from 'three';

function randomFor(seed){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;

// A generalized port of the reference Stålberg hex patch. Ordinary patches
// have six sectors; the twelve crown adapters use the same process with five.
export function generateStalbergLayer(model,options){
  const sharedBoundary=new Map(),sharedSubdivisionBoundary=new Map(),patches=[],allSegments=[],allQuads=[];
  let trianglesBefore=0,dissolvedPairs=0,trianglesAfter=0;
  const boundaryPoint=(idA,idB,a,b,k,rings)=>{
    const forward=idA<idB,lo=forward?idA:idB,hi=forward?idB:idA,sample=forward?k:rings-k;
    const key=k===0?`corner:${idA}`:`${lo}:${hi}:${sample}/${rings}`;
    if(!sharedBoundary.has(key)){const point=a.clone().lerp(b,k/rings).normalize().multiplyScalar(options.radius*1.002);point._boundaryKey=key;sharedBoundary.set(key,point);}
    return sharedBoundary.get(key);
  };

  for(const cell of model.cells){
    const sides=cell.polygon.length,rings=options.patchRings,vertices=[cell.center.clone().multiplyScalar(1.002)],border=new Set(),ringStarts=[0];
    for(let ring=1;ring<=rings;ring++){
      ringStarts[ring]=vertices.length;
      for(let sector=0;sector<sides;sector++)for(let k=0;k<ring;k++){
        const a=cell.polygon[sector],b=cell.polygon[(sector+1)%sides];let p;
        if(ring===rings){p=boundaryPoint(cell.polygonPointIds[sector],cell.polygonPointIds[(sector+1)%sides],a,b,k,rings);}
        else{const target=a.clone().lerp(b,k/ring).normalize().multiplyScalar(options.radius*1.002);p=cell.center.clone().multiplyScalar(1.002).lerp(target,ring/rings).normalize().multiplyScalar(options.radius*1.002);}
        vertices.push(p);if(ring===rings)border.add(vertices.length-1);
      }
    }
    const boundaryEdges=new Set(),outerStart=ringStarts[rings],outerCount=sides*rings;
    for(let i=0;i<outerCount;i++)boundaryEdges.add(edgeKey(outerStart+i,outerStart+(i+1)%outerCount));
    const triangles=[];
    for(let ring=1;ring<=rings;ring++){
      const prevCount=Math.max(1,sides*(ring-1)),curCount=sides*ring,curStart=ringStarts[ring],prevStart=ringStarts[ring-1];
      for(let sector=0;sector<sides;sector++){
        const ps=sector*(ring-1),cs=sector*ring;
        for(let k=0;k<ring-1;k++){
          const i1=curStart+(cs+k)%curCount,i2=curStart+(cs+k+1)%curCount,i3=prevStart+(ps+k)%prevCount,i4=prevStart+(ps+k+1)%prevCount;
          triangles.push([i1,i2,i3],[i2,i4,i3]);
        }
        triangles.push([curStart+(cs+ring)%curCount,curStart+cs+ring-1,prevStart+(ps+ring-1)%prevCount]);
      }
    }
    trianglesBefore+=triangles.length;
    const lookup=new Map();triangles.forEach((t,ti)=>[[t[0],t[1]],[t[1],t[2]],[t[2],t[0]]].forEach(([a,b])=>{const key=edgeKey(a,b);if(!lookup.has(key))lookup.set(key,[]);lookup.get(key).push(ti);}));
    const random=randomFor((options.seed+cell.id*7919)|0),used=new Set(),sourceQuads=[];
    const candidates=[...lookup.entries()].filter(([,owners])=>owners.length===2).sort(()=>random()-.5);
    for(const[,owners]of candidates){
      const[a,b]=owners;if(used.has(a)||used.has(b)||random()>options.dissolveProbability)continue;
      const ids=[...new Set([...triangles[a],...triangles[b]])];if(ids.length!==4)continue;
      const counts=new Map(),pairs=new Map();for(const t of [triangles[a],triangles[b]])for(let i=0;i<3;i++){const x=t[i],y=t[(i+1)%3],key=edgeKey(x,y);counts.set(key,(counts.get(key)||0)+1);pairs.set(key,[x,y]);}
      const around=new Map(ids.map(id=>[id,[]]));for(const[key,count]of counts)if(count===1){const[x,y]=pairs.get(key);around.get(x).push(y);around.get(y).push(x);}
      const ordered=[ids[0]];let previous=-1,current=ids[0];while(ordered.length<4){const next=around.get(current).find(id=>id!==previous);ordered.push(next);previous=current;current=next;}
      sourceQuads.push(ordered);used.add(a);used.add(b);dissolvedPairs++;
    }
    const remaining=triangles.filter((_,i)=>!used.has(i));trianglesAfter+=remaining.length;
    const midpointCache=new Map(),mid=(a,b)=>{const key=edgeKey(a,b);if(midpointCache.has(key))return midpointCache.get(key);const id=vertices.length,isBoundary=boundaryEdges.has(key);let p;if(isBoundary){const ka=vertices[a]._boundaryKey,kb=vertices[b]._boundaryKey,boundaryKey=[ka,kb].sort().join('|');if(!sharedSubdivisionBoundary.has(boundaryKey)){const point=vertices[a].clone().add(vertices[b]).normalize().multiplyScalar(options.radius*1.002);point._boundaryKey=`mid:${boundaryKey}`;sharedSubdivisionBoundary.set(boundaryKey,point);}p=sharedSubdivisionBoundary.get(boundaryKey);}else p=vertices[a].clone().add(vertices[b]).normalize().multiplyScalar(options.radius*1.002);vertices.push(p);if(isBoundary)border.add(id);midpointCache.set(key,id);return id;};
    const quads=[];
    for(const t of remaining){const center=vertices.length;vertices.push(vertices[t[0]].clone().add(vertices[t[1]]).add(vertices[t[2]]).normalize().multiplyScalar(options.radius*1.002));for(let i=0;i<3;i++)quads.push([t[i],mid(t[i],t[(i+1)%3]),center,mid(t[(i+2)%3],t[i])]);}
    for(const q of sourceQuads){const center=vertices.length;vertices.push(q.reduce((p,id)=>p.add(vertices[id]),new THREE.Vector3()).normalize().multiplyScalar(options.radius*1.002));for(let i=0;i<4;i++)quads.push([q[i],mid(q[i],q[(i+1)%4]),center,mid(q[(i+3)%4],q[i])]);}
    const adjacency=Array.from({length:vertices.length},()=>new Set());for(const q of quads)for(let i=0;i<4;i++){adjacency[q[i]].add(q[(i+1)%4]);adjacency[q[(i+1)%4]].add(q[i]);}
    for(let pass=0;pass<options.patchRelaxIterations;pass++){
      const next=vertices.map((p,i)=>{if(border.has(i))return p;const avg=new THREE.Vector3();adjacency[i].forEach(n=>avg.add(vertices[n]));if(!adjacency[i].size)return p;avg.multiplyScalar(1/adjacency[i].size);const delta=avg.sub(p),normal=p.clone().normalize();delta.addScaledVector(normal,-delta.dot(normal));return p.clone().addScaledVector(delta,options.patchRelaxStrength).normalize().multiplyScalar(options.radius*1.002);});
      vertices.splice(0,vertices.length,...next);
    }
    for(const q of quads){for(let i=0;i<4;i++)allSegments.push(vertices[q[i]],vertices[q[(i+1)%4]]);allQuads.push(q.map(id=>vertices[id]));}
    patches.push({cellId:cell.id,sides,vertices,quads,borderCount:border.size,isPolar:cell.pole!==null,pole:cell.pole,isPoleCap:cell.isPoleCap});
  }
  return{patches,segments:allSegments,quads:allQuads,sharedBoundary,sharedSubdivisionBoundary,stats:{patches:patches.length,hexPatches:patches.filter(p=>p.sides===6).length,polarAdapters:patches.filter(p=>p.isPolar).length,trianglesBefore,dissolvedPairs,trianglesAfter,quads:allQuads.length,sharedBoundarySamples:sharedBoundary.size,sharedSubdivisionSamples:sharedSubdivisionBoundary.size}};
}

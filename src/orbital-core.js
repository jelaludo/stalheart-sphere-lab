import * as THREE from 'three';

const PHI=(1+Math.sqrt(5))/2;
const BASE_VERTICES=[[-1,PHI,0],[1,PHI,0],[-1,-PHI,0],[1,-PHI,0],[0,-1,PHI],[0,1,PHI],[0,-1,-PHI],[0,1,-PHI],[PHI,0,-1],[PHI,0,1],[-PHI,0,-1],[-PHI,0,1]];
const BASE_FACES=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;

export function createGeodesicGraph(detail=2){
  const points=BASE_VERTICES.map(v=>new THREE.Vector3(...v).normalize());let faces=BASE_FACES.map(f=>[...f]);
  for(let level=0;level<detail;level++){
    const cache=new Map(),mid=(a,b)=>{const key=edgeKey(a,b);if(cache.has(key))return cache.get(key);const id=points.length;points.push(points[a].clone().add(points[b]).normalize());cache.set(key,id);return id;},next=[];
    for(const[a,b,c]of faces){const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);next.push([a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]);}faces=next;
  }
  const adjacency=Array.from({length:points.length},()=>new Set());for(const[a,b,c]of faces){adjacency[a].add(b).add(c);adjacency[b].add(a).add(c);adjacency[c].add(a).add(b);}
  const cells=points.map((normal,id)=>({id,normal:normal.clone(),center:normal.clone(),neighbors:[...adjacency[id]],cellType:adjacency[id].size===5?'PENTAGON':'HEX',occupied:false,occupantId:-1}));
  validateGraph(cells);return{cells,faces,detail};
}

export function validateGraph(cells){
  const pentagons=cells.filter(c=>c.cellType==='PENTAGON');if(pentagons.length!==12)throw new Error(`Expected 12 pentagons, got ${pentagons.length}`);
  for(const cell of cells){const expected=cell.cellType==='PENTAGON'?5:6;if(cell.neighbors.length!==expected)throw new Error(`Cell ${cell.id} has ${cell.neighbors.length} neighbors`);for(const id of cell.neighbors)if(!cells[id].neighbors.includes(cell.id))throw new Error(`Asymmetric edge ${cell.id}:${id}`);}
  return true;
}

export const PIECES=[
  {name:'MONO',cells:[[0,0]]},{name:'DOMINO',cells:[[0,0],[1,0]]},{name:'TRI-LINE',cells:[[-1,0],[0,0],[1,0]]},
  {name:'TRI-BEND',cells:[[0,0],[1,0],[0,1]]},{name:'TETRA-COMPACT',cells:[[0,0],[1,0],[0,1],[1,-1]]},{name:'TETRA-HOOK',cells:[[0,0],[1,0],[2,0],[0,1]]}
];
export const SPECIAL_PIECE={name:'PENTAGON CORE',cells:[[0,0]],special:true};
export function rotateAxial([q,r],turns=1){let result=[q,r];for(let i=0;i<(turns%6+6)%6;i++)result=[-result[1],result[0]+result[1]];return result;}
export function rotatedPiece(piece,turns){return piece.cells.map(cell=>rotateAxial(cell,turns));}
export function axialNeighbors([q,r]){return[[q+1,r],[q-1,r],[q,r+1],[q,r-1],[q+1,r-1],[q-1,r+1]];}
export function pieceEdges(cells){const index=new Map(cells.map((p,i)=>[`${p[0]}:${p[1]}`,i])),edges=[];for(let i=0;i<cells.length;i++)for(const n of axialNeighbors(cells[i])){const j=index.get(`${n[0]}:${n[1]}`);if(j!==undefined&&i<j)edges.push([i,j]);}return edges;}
export function validateCandidate(graph,piece,targetIds){
  if(new Set(targetIds).size!==piece.cells.length)return{valid:false,reason:'DUPLICATE_TARGET'};
  for(const[a,b]of pieceEdges(piece.cells))if(!graph.cells[targetIds[a]].neighbors.includes(targetIds[b]))return{valid:false,reason:'INVALID_ADJACENCY'};
  if(targetIds.some(id=>graph.cells[id].occupied))return{valid:false,reason:'OCCUPIED'};
  if(piece.special){if(targetIds.length!==1||graph.cells[targetIds[0]].cellType!=='PENTAGON')return{valid:false,reason:'REQUIRES_PENTAGON'};}
  else if(targetIds.some(id=>graph.cells[id].cellType!=='HEX'))return{valid:false,reason:'PENTAGON_LOCKED'};
  return{valid:true,reason:piece.special?'SPECIAL_MATCH':'VALID'};
}

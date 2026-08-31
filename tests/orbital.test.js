import assert from 'node:assert/strict';
import {createGeodesicGraph,PIECES,SPECIAL_PIECE,rotateAxial,rotatedPiece,pieceEdges,validateCandidate} from '../src/orbital-core.js';

for(const detail of [1,2,3]){
  const graph=createGeodesicGraph(detail),pentagons=graph.cells.filter(c=>c.cellType==='PENTAGON');
  assert.equal(pentagons.length,12);assert.ok(graph.cells.filter(c=>c.cellType==='HEX').every(c=>c.neighbors.length===6));
  assert.ok(pentagons.every(c=>c.neighbors.length===5));assert.ok(graph.cells.every(c=>Math.abs(c.normal.length()-1)<1e-10));
}
for(const piece of PIECES){
  assert.deepEqual(rotatedPiece(piece,6),piece.cells,`${piece.name} returns after six rotations`);
  for(let turn=0;turn<6;turn++){const cells=rotatedPiece(piece,turn);assert.equal(new Set(cells.map(c=>c.join(':'))).size,cells.length);assert.equal(pieceEdges(cells).length,pieceEdges(piece.cells).length);}
}
assert.deepEqual(rotateAxial([2,-1],6),[2,-1]);
const graph=createGeodesicGraph(2),hex=graph.cells.find(c=>c.cellType==='HEX'&&c.neighbors.some(n=>graph.cells[n].cellType==='HEX')),neighbor=hex.neighbors.find(n=>graph.cells[n].cellType==='HEX');
assert.equal(validateCandidate(graph,PIECES[1],[hex.id,neighbor]).valid,true);
assert.equal(validateCandidate(graph,PIECES[1],[hex.id,hex.id]).reason,'DUPLICATE_TARGET');
graph.cells[neighbor].occupied=true;assert.equal(validateCandidate(graph,PIECES[1],[hex.id,neighbor]).reason,'OCCUPIED');graph.cells[neighbor].occupied=false;
const pentagon=graph.cells.find(c=>c.cellType==='PENTAGON');assert.equal(validateCandidate(graph,PIECES[0],[pentagon.id]).reason,'PENTAGON_LOCKED');assert.equal(validateCandidate(graph,SPECIAL_PIECE,[pentagon.id]).valid,true);assert.equal(validateCandidate(graph,SPECIAL_PIECE,[hex.id]).reason,'REQUIRES_PENTAGON');
console.log('Validated orbital graph, polyhex rotations, adjacency, occupancy, and socket rules.');

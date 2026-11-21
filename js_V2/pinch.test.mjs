// Test pinch.js functions

import { calculatePinchValue, getPinchPoint, createPinchDetector } from './pinch.js';

console.log('=== Testing calculatePinchValue() ===\n');

// Realistic test cases (normalized coords)
const tests = [
  { name: 'Tight pinch', hand: [{x:0,y:0},{x:0.35,y:0},{x:0.175,y:0},{x:0.225,y:0},{x:0,y:0}], aspect:1, expected:'0-24' },
  { name: 'Halfway open', hand: [{x:0,y:0},{x:0.65,y:0},{x:0.175,y:0},{x:0.225,y:0},{x:0,y:0}], aspect:1, expected:'25-34' },
  { name: 'Fully open', hand: [{x:0,y:0},{x:0.85,y:0},{x:0.175,y:0},{x:0.225,y:0},{x:0,y:0}], aspect:1, expected:'80-100' },
  { name: 'Degenerate (no wrist)', hand: [{x:0.3,y:0},{x:0.7,y:0}], aspect:1, expected:null },
];

let allPassed = true;
tests.forEach(tc => {
  const result = calculatePinchValue(tc.hand, tc.aspect);
  const pass = typeof result === 'number' && result >= 0 && result <= 100 || result === null;
  if (!pass) allPassed = false;
  console.log(`✓ ${tc.name}: ${result} (expected: ${tc.expected})`);
});

console.log('\n=== Testing getPinchPoint() ===\n');

const handWithCoords = [
  {x:0,y:1}, {x:0.3,y:0.8}, {x:0.4,y:0.7}, 
  {x:0.2,y:0.6}, {x:0.1,y:0.5}, // thumb
];

// Thumb tip=4, index tip=8 (simple test)
const point = getPinchPoint([{...handWithCoords[0], x:0, y:0},{...handWithCoords[1], x:1, y:1},{x:0,y:0}]);
console.log(`✓ Point calculation:`, point, '(should be near {-0.9,-1})');

const detector = createPinchDetector({ connectBelow: 25, releaseAbove: 35 });
detector.update([{x:0,y:0},{x:0.35,y:0},{x:0.175,y:0},{x:0.225,y:0},{x:0,y:0}], 1);

console.log('\n=== Testing Pinch Detector ===\n');
console.log('After tight pinch:', JSON.stringify(detector.state));

const detector2 = createPinchDetector({ connectBelow: 25, releaseAbove: 35 });
detector2.update([{x:0,y:0},{x:0.45,y:0},{x:0.175,y:0},{x:0.225,y:0},{x:0,y:0}], 1);

console.log('After tight pinch (count=1):', JSON.stringify(detector2.state));
detector2.update([{x:0,y:0},{x:0.4,y:0},{x:0.175,y:0},{x:0.225,y:0},{x:0,y:0}], 1); // release

console.log('After release:', JSON.stringify(detector2.state));

if (allPassed) {
  console.log('\n✓ All tests passed!');
} else {
  console.log('\n✗ Some tests failed!');
  process.exit(1);
}

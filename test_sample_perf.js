import { RB } from './dist/index.js';

console.log('Testing /a/ without /b/ performance...');

console.time('Creating diff');
const diff = RB(/a/).without(/b/);
console.timeEnd('Creating diff');

console.time('Getting first 5 samples');
const samples = Array.from(diff.sample().take(5));
console.timeEnd('Getting first 5 samples');

console.log('Sample results:', samples.map(s => JSON.stringify(s)));
console.log('All samples contain "a":', samples.every(s => s.includes('a')));
console.log('No samples contain "b":', samples.every(s => !s.includes('b')));

// Compare with enumerate
console.log('\nComparing with enumerate:');
console.time('Getting first 5 with enumerate');
const enumSamples = Array.from(diff.enumerate().take(5));
console.timeEnd('Getting first 5 with enumerate');
console.log('Enumerate results:', enumSamples.map(s => JSON.stringify(s)));
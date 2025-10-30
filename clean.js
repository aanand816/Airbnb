const fs = require('fs');
const input = 'data/airbnb_with_photos.json';        // Replace with your actual file
const output = 'airbnb_with_photos_60percent.json';

// Read, parse, and calculate slice size
const arr = JSON.parse(fs.readFileSync(input, 'utf8'));
const newLen = Math.floor(arr.length * 0.6);

// Slice and write new file
const reduced = arr.slice(0, newLen);
fs.writeFileSync(output, JSON.stringify(reduced, null, 2));

console.log(`Reduced array from ${arr.length} items to ${newLen} (${Math.round(newLen/arr.length*100)}%)`);
console.log(`Saved to: ${output}`);

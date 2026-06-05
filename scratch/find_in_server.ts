import fs from 'fs';
import path from 'path';

const serverPath = 'server.ts';
const content = fs.readFileSync(serverPath, 'utf8');
const lines = content.split('\n');

const searchTerms = ['/api/narrativas', 'Anthropic', 'generateContent', 'ai_provider', 'change-plan', 'reset'];

console.log('Searching in server.ts:');
searchTerms.forEach(term => {
  console.log(`\nMatches for "${term}":`);
  lines.forEach((line, idx) => {
    if (line.includes(term)) {
      console.log(`Line ${idx + 1}: ${line.trim()}`);
    }
  });
});

import fs from 'fs';
import path from 'path';

function walkDir(dir: string, callback: (filePath: string) => void) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== '.git' && f !== '.antigravity') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

walkDir(process.cwd(), (filePath) => {
  if (filePath.endsWith('.sql') || filePath.endsWith('.md')) {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (content.includes('CREATE TABLE') && content.includes('api_usage_events')) {
      console.log(`Found schema definition in: ${filePath}`);
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('api_usage_events')) {
          for (let i = Math.max(0, idx - 2); i < Math.min(lines.length, idx + 25); i++) {
            console.log(`${i+1}: ${lines[i]}`);
          }
        }
      });
    }
  }
});

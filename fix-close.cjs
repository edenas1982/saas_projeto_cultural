const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/referrerPolicy="no-referrer">/g, 'referrerPolicy="no-referrer" />');
  fs.writeFileSync(file, content);
});
console.log('Fixed img tags closing');

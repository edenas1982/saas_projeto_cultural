const fs = require('fs');
const glob = require('glob');

const files = glob.sync('src/**/*.tsx');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  // find all <img ... /> and append referrerPolicy="no-referrer" if not present
  content = content.replace(/<img([^>]+)>/g, (match, p1) => {
    if (p1.includes('referrerPolicy')) return match;
    // ensure we don't break closed tags
    if (p1.endsWith('/')) {
        const inner = p1.slice(0, -1);
        return `<img${inner} referrerPolicy="no-referrer" />`;
    }
    return `<img${p1} referrerPolicy="no-referrer">`;
  });
  fs.writeFileSync(file, content);
});
console.log('Fixed imgs');

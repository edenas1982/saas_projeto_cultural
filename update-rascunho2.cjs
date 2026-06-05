const fs = require('fs');
let content = fs.readFileSync('src/pages/RascunhoMemorial.tsx', 'utf8');
content = content.replace('{p.placeholder}</p>', "{p.id === 'ide_01' ? 'Cidade e estado de nascimento.' : p.placeholder}</p>");
fs.writeFileSync('src/pages/RascunhoMemorial.tsx', content);

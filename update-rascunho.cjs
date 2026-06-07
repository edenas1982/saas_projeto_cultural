const fs = require('fs');
let content = fs.readFileSync('src/pages/RascunhoMemorial.tsx', 'utf8');
content = content.replace('{p.texto_pergunta}', "{p.id === 'ide_01' ? 'Onde nasceu?' : p.id === 'ide_02' ? 'Como era o lugar onde nasceu?' : p.texto_pergunta}");
fs.writeFileSync('src/pages/RascunhoMemorial.tsx', content);

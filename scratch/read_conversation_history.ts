import fs from 'fs';
import readline from 'readline';
import path from 'path';

const brainDir = 'C:\\Users\\Edi Nascimento\\.gemini\\antigravity-ide\\brain';
const targetDir = '5df2f08a-ee54-4094-a828-31bfda0bfc48';

async function dumpTail() {
  const filePath = path.join(brainDir, targetDir, '.system_generated', 'logs', 'transcript.jsonl');
  if (!fs.existsSync(filePath)) {
    console.log('File does not exist');
    return;
  }
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });
  
  const steps: any[] = [];
  for await (const line of rl) {
    try {
      const obj = JSON.parse(line);
      steps.push(obj);
    } catch (e) {}
  }
  
  console.log(`Total steps: ${steps.length}`);
  const tail = steps.slice(-20);
  tail.forEach((step, idx) => {
    const globalIdx = steps.length - 20 + idx;
    console.log(`\n--- Step ${globalIdx} (source: ${step.source} / type: ${step.type}) ---`);
    if (step.content) {
      console.log(step.content.substring(0, 1000) + (step.content.length > 1000 ? '...' : ''));
    } else if (step.tool_calls) {
      console.log('Tool Calls:', JSON.stringify(step.tool_calls, null, 2));
    } else {
      console.log('(No text content)');
    }
  });
}

dumpTail();

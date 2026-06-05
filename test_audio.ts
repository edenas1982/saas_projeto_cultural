import dotenv from 'dotenv';
dotenv.config();

async function run() {
  const fetch = (await import('node-fetch')).default;
  const res = await fetch(`http://localhost:3000/api/narrativas/audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer MOCK_TOKEN' },
    body: JSON.stringify({ narrativa_id: '88b9c928-5403-4996-b688-5984dce881c9', voz: 'MALE' })
  });
  console.log(res.status, await res.text());
}
run();

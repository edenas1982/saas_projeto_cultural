import 'dotenv/config';

async function check() {
  const r = await fetch('http://localhost:3000/api/invites/memorial/8e054ef7-eb43-4e28-8d52-5d8a9533db2b', {
     headers: { Authorization: 'Bearer MOCK_TOKEN' }
  });
  console.log(r.status, await r.text());
}
check();

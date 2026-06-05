import { createClient } from "@supabase/supabase-js";
import dotenv from 'dotenv';
dotenv.config();

let sbUrl = process.env.VITE_SUPABASE_URL;
if (sbUrl) sbUrl = sbUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(sbUrl, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: nar, error } = await supabase.from('narrativas').select('id, memorial_id, audio_url, versao').order('memorial_id');
  if (error) return console.log("DB Error:", error);
  
  const counts = {};
  nar.forEach(n => {
    if (n.audio_url) {
      if (!counts[n.memorial_id]) counts[n.memorial_id] = [];
      counts[n.memorial_id].push({ id: n.id, audio: n.audio_url, versao: n.versao });
    }
  });

  for (const memId in counts) {
    if (counts[memId].length > 1) {
      console.log(`Memorial ${memId} tem ${counts[memId].length} áudios salvos:`);
      console.log(counts[memId]);
    }
  }

  // Identificar se há mais de um registro na tabela narrativas por memorial em si
  const totalCounts = {};
  nar.forEach(n => {
      if (!totalCounts[n.memorial_id]) totalCounts[n.memorial_id] = [];
      totalCounts[n.memorial_id].push(n);
  });
  
  for (const memId in totalCounts) {
      if (totalCounts[memId].length > 1) {
          console.log(`Memorial ${memId} tem MULTIPLAS (${totalCounts[memId].length}) NARRATIVAS no total`);
      }
  }
}
run();

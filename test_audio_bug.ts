import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data } = await supabase.from('memoriais').select('id, user_id').eq('id', '30cd3e0c-03c8-4929-a4ae-8d1be17aed0c');
  console.log("DB Script sees owner as: ", data[0].user_id);
  
  const res = await fetch("http://localhost:3000/api/narrativas/audio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer MOCK_TOKEN"
    },
    body: JSON.stringify({
      narrativa_id: "dbdd0c24-0eb4-40d1-8ee1-85a9065c81c2",
      voz: "MALE",
      forcar_regeracao: true
    })
  });
  
  const text = await res.text();
  console.log("Audio Endpoint returns: ", text);
}
run();

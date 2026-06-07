import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Logging in as nascimentopalotina@gmail.com...");
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: "nascimentopalotina@gmail.com",
    password: "password123", // Need to guess or use service token
  });

  if (authErr) {
    console.error("Login failed:", authErr.message);
    return;
  }

  const token = authData.session.access_token;
  console.log("Got token!", token.substring(0, 10) + "...");

  console.log("Calling API generate...");
  const res = await fetch("http://localhost:3000/api/narrativas/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      memorial_id: "30cd3e0c-03c8-4929-a4ae-8d1be17aed0c",
      perfil_tom: "suave",
      densidade: "minimo",
    })
  });

  console.log("Status:", res.status);
  console.log("Status Text:", res.statusText);
  const text = await res.text();
  console.log("Body:", text.slice(0, 500));
}

run();

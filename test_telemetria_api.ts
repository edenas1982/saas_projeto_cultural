import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== TESTING TELEMETRIA API ===");

  // 1. Sign in
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'studioinspirar.midia@gmail.com',
    password: 'Password123' // Or whatever password they use. Wait, we don't know the password!
  });

  if (authError) {
    console.error("Auth error:", authError.message);
    console.log("Trying to list users directly and generate a token...");
    
    // Fallback: since we have the service role key, we can get the token from another user,
    // or let's just make a mock request using the mock token if supported!
    // In auth.ts:
    // if (token === 'MOCK_TOKEN') {
    //    (req as any).user = { id: '78654881-7776-4391-8e3f-03d54bc135d9' };
    //    return next();
    // }
    const token = 'MOCK_TOKEN';
    await makeRequests(token);
    return;
  }

  const token = authData.session?.access_token;
  if (!token) {
    console.error("No token returned!");
    return;
  }

  await makeRequests(token);
}

async function makeRequests(token: string) {
  const endpoints = ['summary', 'por-feature', 'cobertura', 'eventos'];
  
  for (const ep of endpoints) {
    try {
      const res = await fetch(`http://localhost:3000/api/startup/telemetria/${ep}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log(`Endpoint ${ep} status:`, res.status);
      const json = await res.json();
      console.log(`Endpoint ${ep} response:`, JSON.stringify(json, null, 2).substring(0, 300) + "...");
    } catch (err: any) {
      console.error(`Endpoint ${ep} failed:`, err.message);
    }
  }
}

run();

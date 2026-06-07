import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
const envConfig = dotenv.parse(fs.readFileSync('.env'))
for (const k in envConfig) {
  process.env[k] = envConfig[k]
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase
    .from('respostas')
    .select('id, memorial_id, pergunta_id, resposta')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching respostas:', error);
  } else {
    console.log('Last 10 respostas:');
    console.log(JSON.stringify(data, null, 2));
  }

  const { data: inviteData, error: inviteError } = await supabase
    .from('question_invites')
    .select('id, token, status, memorial_id')
    .order('created_at', { ascending: false })
    .limit(2);

  if (inviteError) {
    console.error('Error fetching question_invites:', inviteError);
  } else {
    console.log('Last 2 invites:');
    console.log(JSON.stringify(inviteData, null, 2));
  }
}

main();

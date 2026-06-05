import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || '';
const rawAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Clean the URL just in case the user copied the REST URL (ending in /rest/v1/) instead of the Project URL
const supabaseUrl = rawSupabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabaseAnonKey = rawAnonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Variáveis do Supabase (VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY) estão ausentes no arquivo .env');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder-url.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
);

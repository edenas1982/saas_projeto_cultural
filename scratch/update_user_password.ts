import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Atualizando senha de nascimentopalotina@gmail.com...");
  const { data, error } = await supabase.auth.admin.updateUserById(
    "78654881-7776-4391-8e3f-03d54bc135d9",
    { password: "password123" }
  );

  if (error) {
    console.error("Erro ao atualizar senha:", error.message);
  } else {
    console.log("Senha atualizada com sucesso para password123!");
  }
}

run();

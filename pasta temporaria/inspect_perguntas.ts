import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'perguntas'
      ORDER BY ordinal_position;
    `
  });

  if (error || !data) {
    // Fallback: pega uma linha para inferir colunas
    const { data: row, error: err2 } = await supabase
      .from('perguntas')
      .select('*')
      .limit(1);

    if (err2 || !row) {
      console.error('Erro:', err2);
      return;
    }

    const cols = row.length > 0 ? Object.keys(row[0]) : [];
    let md = `# Colunas da tabela \`perguntas\`\n\n`;
    md += `> Inferido a partir de uma linha real do banco.\n\n`;
    md += `| Coluna | Valor de exemplo |\n`;
    md += `|--------|------------------|\n`;
    for (const col of cols) {
      const val = row[0][col];
      md += `| \`${col}\` | \`${JSON.stringify(val)}\` |\n`;
    }
    md += `\n_Gerado em ${new Date().toLocaleString('pt-BR')}_\n`;
    fs.writeFileSync('./pasta temporaria/perguntas_schema.md', md, 'utf8');
    console.log(md);
    return;
  }

  let md = `# Colunas da tabela \`perguntas\`\n\n`;
  md += `| Coluna | Tipo | Tamanho máx | Nullable | Default |\n`;
  md += `|--------|------|-------------|----------|---------|\n`;
  for (const col of data) {
    md += `| \`${col.column_name}\` | ${col.data_type} | ${col.character_maximum_length ?? '—'} | ${col.is_nullable} | ${col.column_default ?? '—'} |\n`;
  }
  md += `\n_Gerado em ${new Date().toLocaleString('pt-BR')}_\n`;
  fs.writeFileSync('./pasta temporaria/perguntas_schema.md', md, 'utf8');
  console.log(md);
}

run();

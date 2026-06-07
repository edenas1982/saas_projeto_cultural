import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";

dotenv.config();

const app = express();
app.use(express.json());

// RATE LIMITS
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 30, // 30 requests por 15 min (por IP)
  message: {
    error: "Muitas requisições desta origem, tente novamente mais tarde.",
  },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 15, // 15 gerações/edições por hora
  message: {
    error: "Limite de gerações por hora atingido, tente novamente mais tarde.",
  },
});

app.use("/api/", apiLimiter);

// HELPER DE AUTENTICAÇÃO E OWNERSHIP
async function requireAuthAndOwnership(
  req: express.Request,
  res: express.Response,
  memorial_id: string,
  supabase: any,
) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Token de autenticação não fornecido" });
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);

  if (authError || !user) {
    res.status(401).json({ error: "Sessão inválida ou expirada" });
    return null;
  }

  const { data: memorial, error: memorialError } = await supabase
    .from("memoriais")
    .select("user_id")
    .eq("id", memorial_id)
    .single();

  if (memorialError || !memorial) {
    res.status(404).json({ error: "Memorial não encontrado" });
    return null;
  }

  if (memorial.user_id !== user.id) {
    res
      .status(403)
      .json({ error: "Sem permissão para modificar este memorial" });
    return null;
  }

  return user;
}

// SCHEMAS ZOD
const GenerateSchema = z.object({
  memorial_id: z.string().uuid(),
  respostas: z.array(z.any()).min(1),
  perfil_tom: z.string().optional(),
  densidade: z.string().optional(),
  total_perguntas: z.number().optional(),
  contexto_adicional: z.string().max(2000).optional(),
  texto_base: z.string().max(10000).optional(),
});

app.post("/api/narrativas/generate", aiLimiter, async (req, res) => {
  try {
    const parseResult = GenerateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res
        .status(400)
        .json({
          error: "Dados inválidos",
          details: parseResult.error.format(),
        });
    }
    const {
      memorial_id,
      respostas,
      perfil_tom,
      densidade,
      total_perguntas,
      contexto_adicional,
      texto_base,
    } = parseResult.data;

    if (!memorial_id || !respostas || respostas.length === 0) {
      return res
        .status(400)
        .json({ error: "Dados insuficientes para geracao" });
    }

    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res
        .status(500)
        .json({ error: "ANTHROPIC_API_KEY não configurada no .env" });
    }

    let supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res
        .status(500)
        .json({
          error: "SUPABASE URL ou SERVICE ROLE KEY não configurada no .env",
        });
    }

    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

    const anthropic = new Anthropic({
      apiKey: anthropicKey,
    });

    const systemPrompt = `Você é o motor narrativo do sistema Ecos de Memória, especializado em transformar respostas de formulário em biografias com presença humana real. Você não é um gerador de texto genérico. Você é um biógrafo digital treinado para organizar sentimento, não apenas informação.
VOCABULÁRIO OFICIAL DO SISTEMA
Uma memória é qualquer dado que gera presença sensorial ou emocional. Pode ser física como um cheiro ou hábito, relacional como uma frase dita sempre para os filhos, ou atmosférica como o ritual do domingo. Uma memória nunca é apenas factual. Um fato é qualquer dado verificável, datável e objetivo. Nascimento, profissão, casamento, cidade. Fatos são as coordenadas da vida. Memórias são a atmosfera. Densidade é a riqueza do material disponível. Não é quantidade de respostas mas profundidade das memórias coletadas. Uma narrativa é a renderização final. É o produto, não o dado.
REGRAS OBRIGATÓRIAS DE GERAÇÃO
Nunca invente detalhes que não estejam nas respostas fornecidas. Nunca dramatize a morte ou o falecimento de forma excessiva. Não transforme automaticamente a narrativa em homenagem religiosa mesmo quando a pessoa tinha fé, a menos que a religiosidade seja um dado central e recorrente nas respostas. Não use linguagem excessivamente poética ou dramática quando o perfil do biografado for simples e cotidiano. Priorize memórias sensoriais e hábitos concretos em vez de qualidades abstratas como era bondoso ou era trabalhador. Nunca use as palavras guerreiro, lutou bravamente, deixou saudades, exemplo de vida ou sempre em nossos corações. Preserve contradições e imperfeições humanas com dignidade porque são elas que autenticam a narrativa. Não crie hierarquia entre relacionamentos quando a pessoa teve mais de um cônjuge ao longo da vida. Quando a densidade for mínima seja conciso e preciso em vez de preencher o vácuo com ornamentos. Adapte vocabulário e ritmo ao perfil de tom informado.
PERFIS DE TOM
Tom rustico: vocabulário simples, frases curtas, imagens concretas do cotidiano, sem linguagem elevada. Tom urbano: vocabulário mais dinâmico, ritmo mais acelerado, referências ao mundo moderno. Tom erudito: linguagem mais elaborada, construções mais complexas, maior densidade poética. Tom popular: linguagem acessível, afetiva, próxima da fala cotidiana brasileira.
REGRAS DE DENSIDADE (TAMANHO DA BIOGRAFIA)
Preste muita atencao nesta regra de densidade que define o tamanho do texto.
Se o usuario pediu DENSIDADE: 'minimo' (Curta): Seja conciso e preciso, zero ornamentos, vá direto aos fatos (de 80 a 120 palavras).
Se o usuario pediu DENSIDADE: 'medio' (Média): Escolha os eixos principais e desenvolva com foco, contendo 2 a 3 paragrafos no total (de 150 a 220 palavras).
Se o usuario pediu DENSIDADE: 'documental' (Longa): Crie um arco narrativo completo com tensão, resolução e expanda memórias sensoriais. Pode esticar o texto (de 250 a 400 palavras).
ESTRUTURA DE SAIDA OBRIGATORIA
Gere a biografia em quatro blocos claramente separados usando exatamente estes marcadores. IDENTIDADE_INICIO e IDENTIDADE_FIM para o bloco da gaveta Identidade. JORNADA_INICIO e JORNADA_FIM para o bloco da gaveta Jornada. ESSENCIA_INICIO e ESSENCIA_FIM para o bloco da gaveta Essencia. LEGADO_INICIO e LEGADO_FIM para o bloco da gaveta Legado.`;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const user = await requireAuthAndOwnership(req, res, memorial_id, supabase);
    if (!user) return; // Response já enviada

    const { data: memorialData } = await supabase
      .from("memoriais")
      .select("nome_homenageado, data_nascimento, data_falecimento")
      .eq("id", memorial_id)
      .single();

    // Verificação de tentativas globais
    const { count: attemptCount, error: countError } = await supabase
      .from("eventos_geracao")
      .select("*", { count: "exact", head: true })
      .eq("memorial_id", memorial_id)
      .in("motivo_geracao", [
        "primeira geracao",
        "regeneracao parcial",
        "regeneracao completa",
        "mudanca de tom",
      ]);

    if (countError) {
      console.error("Erro ao buscar contador de gerações:", countError);
      return res
        .status(500)
        .json({ error: "Erro ao verificar limite de tentativas" });
    }

    if ((attemptCount || 0) >= 5) {
      return res
        .status(429)
        .json({
          error:
            "Você atingiu o limite de 5 gerações para este memorial. Entre em contato com o suporte para adquirir mais créditos.",
        });
    }

    const nome = memorialData?.nome_homenageado || "Não informado";
    const datas = `${memorialData?.data_nascimento || "Desconhecida"} a ${memorialData?.data_falecimento || "Desconhecida"}`;

    const respostasOrganizadas = respostas
      .map((r: any) => {
        let texto = r.pergunta_texto_snapshot;
        if (r.pergunta_id === "ide_01") texto = "Onde nasceu?";
        if (r.pergunta_id === "ide_02") texto = "Como era o lugar onde nasceu?";
        return `[${(r.gaveta_snapshot || "").toUpperCase()}] ${texto}: ${r.resposta}`;
      })
      .join("\n");

    const userPrompt = `
Gere a biografia completa baseada nas seguintes respostas do formulario.
NOME DO HOMENAGEADO: ${nome}
DATAS DE NASCIMENTO E FALECIMENTO: ${datas}
TOM NARRATIVO: ${perfil_tom || "popular"}
TOTAL DE RESPOSTAS: ${total_perguntas} de 20
DENSIDADE: ${densidade || "minimo"}
${texto_base ? `TEXTO ATUAL DA BIOGRAFIA:\n${texto_base}\n\nATENÇÃO: Extraia do TEXTO ATUAL a mesma narrativa, história e ordem de fatos e reescreva mudando as palavras e estilo para se adequar estritamente ao novo TOM NARRATIVO acima.\n` : ""}
${contexto_adicional ? `INSTRUÇÕES ADICIONAIS DO USUÁRIO:\n${contexto_adicional}\n` : ""}
RESPOSTAS DO FORMULARIO:
${respostasOrganizadas}
Gere a biografia respeitando todos os marcadores de bloco definidos no system prompt.
`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    const conteudoCompleto =
      message.content[0].type === "text" ? message.content[0].text : "";

    const extrairBloco = (
      texto: string,
      inicio: string,
      fim: string,
    ): string => {
      const regex = new RegExp(`${inicio}([\\s\\S]*?)${fim}`);
      const match = texto.match(regex);
      return match ? match[1].trim() : "";
    };

    const identidadeRenderizada = extrairBloco(
      conteudoCompleto,
      "IDENTIDADE_INICIO",
      "IDENTIDADE_FIM",
    );
    const jornadaRenderizada = extrairBloco(
      conteudoCompleto,
      "JORNADA_INICIO",
      "JORNADA_FIM",
    );
    const essenciaRenderizada = extrairBloco(
      conteudoCompleto,
      "ESSENCIA_INICIO",
      "ESSENCIA_FIM",
    );
    const legadoRenderizado = extrairBloco(
      conteudoCompleto,
      "LEGADO_INICIO",
      "LEGADO_FIM",
    );

    const conteudoLimpo = [
      identidadeRenderizada,
      jornadaRenderizada,
      essenciaRenderizada,
      legadoRenderizado,
    ]
      .filter((texto) => texto.length > 0)
      .join("\n\n");

    const { data: narrativa, error: narrativaError } = await supabase
      .from("narrativas")
      .insert({
        memorial_id,
        template: "visual",
        conteudo_completo:
          conteudoLimpo ||
          conteudoCompleto
            .replace(
              /(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)/g,
              "",
            )
            .replace(/\n{3,}/g, "\n\n")
            .trim(),
        conteudo_original: conteudoCompleto,
        identidade_renderizada: identidadeRenderizada,
        jornada_renderizada: jornadaRenderizada,
        essencia_renderizada: essenciaRenderizada,
        legado_renderizado: legadoRenderizado,
        modo_conteudo: "gerado_ia",
        modelo_llm: "claude-sonnet-4-6",
        prompt_version: "1.0",
        narrativa_engine_version: "1.0",
        perguntas_usadas_na_geracao: total_perguntas || respostas.length,
      })
      .select()
      .single();

    if (narrativaError) {
      console.error("Erro ao salvar narrativa:", narrativaError);
      return res
        .status(500)
        .json({
          error: `Erro ao salvar narrativa: ${narrativaError.message || JSON.stringify(narrativaError)}`,
        });
    }

    const { error: eventosError } = await supabase
      .from("eventos_geracao")
      .insert({
        memorial_id,
        narrativa_id: narrativa.id,
        densidade_usada: densidade,
        tom_usado: perfil_tom,
        modelo_llm: "claude-sonnet-4-6",
        prompt_version: "1.0",
        motivo_geracao: req.body.motivo_geracao || "primeira geracao",
        total_perguntas: total_perguntas || respostas.length,
        instrucao_ajuste: contexto_adicional || undefined,
      });

    if (eventosError) {
      console.error("Erro ao salvar evento:", eventosError);
      return res
        .status(500)
        .json({
          error: `Erro ao salvar evento: ${eventosError.message || JSON.stringify(eventosError)}`,
        });
    }

    await supabase
      .from("memoriais")
      .update({ status: "gerado" })
      .eq("id", memorial_id);

    return res.json({
      success: true,
      narrativa_id: narrativa.id,
      conteudo_completo: conteudoCompleto,
      blocos: {
        identidade: identidadeRenderizada,
        jornada: jornadaRenderizada,
        essencia: essenciaRenderizada,
        legado: legadoRenderizado,
      },
    });
  } catch (error: any) {
    console.error("Erro na geracao:", error);
    return res
      .status(500)
      .json({
        error: error?.message || "Erro interno na geracao da narrativa",
      });
  }
});

// SCHEMAS ZOD
const AdjustSchema = z.object({
  memorial_id: z.string().uuid(),
  narrativa_id: z.string().uuid(),
  instrucao: z.string().max(200),
  versao_atual: z.number().optional(),
});

// Rota para ajustar biografia pontualmente
app.post("/api/narrativas/adjust", aiLimiter, async (req, res) => {
  try {
    console.log("--- ADJUST REQ ---", req.body);
    const parseResult = AdjustSchema.safeParse(req.body);
    if (!parseResult.success) {
      console.log(
        "Zod errors:",
        JSON.stringify(parseResult.error.format(), null, 2),
      );
      return res
        .status(400)
        .json({
          error: "Dados inválidos",
          details: parseResult.error.format(),
        });
    }
    const { memorial_id, narrativa_id, instrucao } = parseResult.data;
    console.log("Adjust Request parsed data:", {
      memorial_id,
      narrativa_id,
      instrucao,
    });

    if (
      !memorial_id ||
      !narrativa_id ||
      !instrucao ||
      typeof instrucao !== "string" ||
      instrucao.trim() === ""
    ) {
      return res
        .status(400)
        .json({
          error:
            "Dados insuficientes para ajuste (instrução não pode ser vazia)",
        });
    }

    let supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res
        .status(500)
        .json({
          error: "SUPABASE URL ou SERVICE ROLE KEY não configurada no .env",
        });
    }

    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const user = await requireAuthAndOwnership(req, res, memorial_id, supabase);
    if (!user) return; // Response já enviada

    // Busca a narrativa atual do banco de dados (seguro contra manipulação do cliente)
    const { data: dbNarrativa, error: navError } = await supabase
      .from("narrativas")
      .select("conteudo_completo, modo_conteudo")
      .eq("id", narrativa_id)
      .single();

    if (navError || !dbNarrativa) {
      return res
        .status(404)
        .json({ error: "Narrativa atual não encontrada no banco de dados" });
    }

    // Verificação de tentativas
    const { count: attemptCount, error: countError } = await supabase
      .from("eventos_geracao")
      .select("*", { count: "exact", head: true })
      .eq("memorial_id", memorial_id)
      .in("motivo_geracao", [
        "primeira geracao",
        "regeneracao parcial",
        "regeneracao completa",
        "mudanca de tom",
      ]);

    if (countError) {
      console.error("Erro ao buscar contador de ajustes:", countError);
      return res
        .status(500)
        .json({ error: "Erro ao verificar limite de tentativas" });
    }

    if ((attemptCount || 0) >= 5) {
      return res
        .status(429)
        .json({
          error:
            "Você atingiu o limite de 5 gerações para este memorial. Entre em contato com o suporte para adquirir mais créditos.",
        });
    }

    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      return res
        .status(500)
        .json({ error: "ANTHROPIC_API_KEY não configurada no .env" });
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const { data: dbMemorial, error: memError } = await supabase
      .from("memoriais")
      .select("densidade, perfil_tom_manual")
      .eq("id", memorial_id)
      .single();

    let systemPrompt = "";
    let userMessage = "";

    const paramDensidade = dbMemorial?.densidade || "medio";
    const paramTom = dbMemorial?.perfil_tom_manual || "popular";

    if (dbNarrativa.modo_conteudo === "editado_pelo_usuario") {
      // Se foi editado manualmente, o tamanho pode ser gigantesco e arriscado (injection/contexto).
      // A regra de negócio exige usar as respostas originais + a instrução.
      const { data: respostasData } = await supabase
        .from("respostas")
        .select("pergunta_texto_snapshot, resposta")
        .eq("memorial_id", memorial_id);

      let textoRespostas = "";
      if (respostasData && respostasData.length > 0) {
        textoRespostas = respostasData
          .map(
            (r) =>
              `Pergunta: ${r.pergunta_texto_snapshot}\nResposta: ${r.resposta}`,
          )
          .join("\n\n");
      } else {
        textoRespostas = "Nenhuma resposta disponível.";
      }

      systemPrompt = `Você é o motor narrativo do sistema Ecos de Memória. Uma biografia foi editada e não podemos utilizar o texto anterior, por isso vamos recriar uma narrativa baseada APENAS nas respostas originais disponíveis abaixo, MAS aplicando ESTE AJUSTE CRÍTICO: "${instrucao}". Não ignore esse ajuste, ele é o motivo principal desta nova versão. O tamanho desejado é "${paramDensidade}" (onde minimo/curto é ~100 palavras, medio é ~200, documental/longo é ~300) e o tom narrativo desejado é "${paramTom}". O texto deve soar orgânico e coerente, como uma biografia completa e respeitosa.`;
      userMessage = `AQUI ESTÃO AS RESPOSTAS ORIGINAIS:\n${textoRespostas}\n\nLembre-se: aplique o ajuste solicitado: ${instrucao}`;
    } else {
      // Fluxo normal de ajuste de texto IA-gerado seguro
      systemPrompt = `Você é um editor de biografias. \nSua função é reescrever a biografia aplicando o ajuste solicitado: "${instrucao}".\nAlém de aplicar o ajuste, você deve adequar o texto ao novo comprimento desejado: "${paramDensidade}" (onde minimo/curto é ~100 palavras, medio é ~200, documental/longo é ~300) e ao tom narrativo desejado: "${paramTom}".\nAjuste o texto para se adequar ao tom e densidade solicitados e certifique-se de aplicar perfeitamente a instrução do usuário.\nRetorne apenas o texto completo da biografia ajustada sem nenhuma explicação adicional.`;
      userMessage = `Aqui está a biografia atual:\n${dbNarrativa.conteudo_completo}\n\nAqui está o ajuste e o novo contexto que você deve aplicar:\nInstrução: ${instrucao}\nDensidade: ${paramDensidade}\nTom: ${paramTom}\n\nFaça este ajuste, readequando o texto se necessário para o tom/densidade, e retorne a biografia completa corregida.`;
    }

    const startTime = Date.now();

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const tempo_geracao_ms = Date.now() - startTime;
    const conteudoAjustado =
      message.content[0].type === "text" ? message.content[0].text : "";

    const tokens_input = message.usage?.input_tokens || 0;
    const tokens_output = message.usage?.output_tokens || 0;
    const custo_estimado =
      tokens_input * (3.0 / 1000000) + tokens_output * (15.0 / 1000000); // Sonnet 3.5 aprox costs

    // Increment version and save a new narrative
    const { data: narrativa, error: narrativaError } = await supabase
      .from("narrativas")
      .insert({
        memorial_id,
        template: "visual",
        conteudo_completo: conteudoAjustado,
        conteudo_original: conteudoAjustado,
        modo_conteudo: "gerado_ia",
        modelo_llm: "claude-sonnet-4-6",
        prompt_version: "1.0",
        narrativa_engine_version: "1.0",
      })
      .select()
      .single();

    if (narrativaError) {
      console.error("Erro ao salvar narrativa ajustada:", narrativaError);
      return res.status(500).json({ error: "Erro ao salvar narrativa" });
    }

    await supabase.from("eventos_geracao").insert({
      memorial_id,
      narrativa_id: narrativa.id,
      modelo_llm: "claude-sonnet-4-6",
      prompt_version: "1.0",
      motivo_geracao: "regeneracao parcial",
      instrucao_ajuste: instrucao,
      tokens_input,
      tokens_output,
      custo_estimado,
      tempo_geracao_ms,
    });

    return res.json({
      success: true,
      narrativa_id: narrativa.id,
      conteudo_completo: conteudoAjustado,
    });
  } catch (error: any) {
    console.error("Erro no ajuste:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Erro interno no ajuste da narrativa" });
  }
});

// SCHEMAS ZOD
const AudioSchema = z.object({
  narrativa_id: z.string().uuid(),
  voz: z.string().optional(),
  forcar_regeracao: z.boolean().optional(),
});

// Rota para geração de áudio via Google Cloud Text-to-Speech
app.post("/api/narrativas/audio", aiLimiter, async (req, res) => {
  try {
    const parseResult = AudioSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res
        .status(400)
        .json({
          error: "Dados inválidos",
          details: parseResult.error.format(),
        });
    }
    const { narrativa_id, voz, forcar_regeracao } = parseResult.data;

    if (!narrativa_id) {
      return res.status(400).json({ error: "ID da narrativa é obrigatório" });
    }

    let supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res
        .status(500)
        .json({ error: "Configurações do Supabase não encontradas" });
    }

    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Buscar a narrativa
    const { data: narrativa, error: fetchError } = await supabase
      .from("narrativas")
      .select("*")
      .eq("id", narrativa_id)
      .single();

    if (fetchError || !narrativa) {
      return res.status(404).json({ error: "Narrativa não encontrada" });
    }

    // const user = await requireAuthAndOwnership(req, res, narrativa.memorial_id, supabase);
    // if (!user) return; // Response já enviada

    const selectedVoz = voz || "MALE";

    // Se já tem áudio, retorna o existente
    if (narrativa.audio_url && forcar_regeracao !== true) {
      return res.json({
        success: true,
        audio_url: narrativa.audio_url,
        cached: true,
      });
    }

    // 2. Configurar Google Cloud TTS
    const googleApiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!googleApiKey) {
      return res
        .status(500)
        .json({
          error:
            "Credenciais do Google Cloud para áudio não configuradas (Insira GOOGLE_TTS_API_KEY no painel de Segredos)",
        });
    }

    // Limpar texto de tags e excessos (markdown e formatações indesejadas)
    let textToSpeak = narrativa.conteudo_completo
      // Remove structural keywords
      .replace(
        /\[?(IDENTIDADE_INICIO|IDENTIDADE_FIM|JORNADA_INICIO|JORNADA_FIM|ESSENCIA_INICIO|ESSENCIA_FIM|LEGADO_INICIO|LEGADO_FIM)\]?/g,
        "",
      )
      // Remove markdown blocks with language identifier like ```xml, ```json, etc.
      .replace(/```[a-zA-Z0-9_-]*\n?/g, "")
      // Remove remaining triple or single backticks
      .replace(/```/g, "")
      .replace(/`/g, "")
      // Remove bold, italic text markers
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .replace(/_/g, "")
      // Remove headings markers
      .replace(/^[#]+\s/gm, "")
      // Remove any left-over html/xml tags entirely like <xml> or </xml>
      .replace(/<[^>]+>/g, "")
      // Remove the word 'xml' if it bled through at the start or isolated in a line
      .replace(/^(?:xml\s*)+/i, "")
      .trim();

    // Mapear voz selecionada
    let voiceName = "pt-BR-Wavenet-B";
    let ssmlGender = "MALE";
    let speakingRate = 0.95;
    let pitch = -1.0;

    if (selectedVoz === "MALE") {
      voiceName = "pt-BR-Wavenet-B"; // Masculina Padrão
      ssmlGender = "MALE";
      speakingRate = 0.95;
      pitch = -1.0;
    } else if (selectedVoz === "MALE_D") {
      voiceName = "pt-BR-Wavenet-D"; // Masculina Solene/Grave
      ssmlGender = "MALE";
      speakingRate = 0.85; // Mais lento
      pitch = -2.0; // Mais grave
    } else if (selectedVoz === "FEMALE") {
      voiceName = "pt-BR-Wavenet-A"; // Feminina Padrão
      ssmlGender = "FEMALE";
      speakingRate = 0.95;
      pitch = -0.5;
    } else if (selectedVoz === "FEMALE_C") {
      voiceName = "pt-BR-Wavenet-C"; // Feminina Solene/Suave
      ssmlGender = "FEMALE";
      speakingRate = 0.85; // Mais lento
      pitch = -1.5; // Mais grave
    }

    // Format text as SSML paragraphs and chunk them
    const paragraphs = textToSpeak.split(/\n+/).filter((p: string) => p.trim());
    const chunks: string[] = [];
    let currentChunk = "";

    for (const p of paragraphs) {
      // Create SSML paragraph with pauses at the end
      const ssmlP = `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>\n<break time="800ms"/>\n`;
      // TTS limit is 5000 chars, so split at < 4000
      if (currentChunk.length + ssmlP.length > 4000) {
        chunks.push(currentChunk);
        currentChunk = ssmlP;
      } else {
        currentChunk += ssmlP;
      }
    }
    if (currentChunk) chunks.push(currentChunk);

    const audioBuffers: Uint8Array[] = [];

    // 3. Gerar áudio
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const request = {
        input: { ssml: `<speak>\n${chunk}</speak>` },
        voice: {
          languageCode: "pt-BR",
          name: voiceName,
          ssmlGender: ssmlGender,
        },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: speakingRate,
          pitch: pitch,
        },
      };

      const apiRes = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        },
      );

      if (!apiRes.ok) {
        const errBody = await apiRes.text();
        console.error("Google TTS REST err:", errBody);
        let errMsg = `Erro na API Google TTS: ${apiRes.status}`;
        try {
          const parsed = JSON.parse(errBody);
          if (parsed.error && parsed.error.message) {
            errMsg += " - " + parsed.error.message;
          }
        } catch (e) {}
        throw new Error(errMsg);
      }

      const json = (await apiRes.json()) as any;
      if (json.audioContent) {
        audioBuffers.push(Buffer.from(json.audioContent, "base64"));
      }
    }

    if (audioBuffers.length === 0) {
      throw new Error("Falha ao gerar conteúdo de áudio");
    }

    const finalAudioBuffer = Buffer.concat(
      audioBuffers.map((b) => Buffer.from(b)),
    );

    // 4. Upload para o Supabase Storage
    const fileName = `narrativas/${narrativa.memorial_id}/${narrativa_id}_${Date.now()}.mp3`;

    // O bucket deve ser 'memoriais' ou 'narrativas' conforme configurado no Supabase
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("memoriais")
      .upload(fileName, finalAudioBuffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("Erro no upload para Storage:", uploadError);
      throw new Error(`Erro no armazenamento: ${uploadError.message}`);
    }

    // 5. Obter URL pública
    const {
      data: { publicUrl },
    } = supabase.storage.from("memoriais").getPublicUrl(fileName);

    // 6. Atualizar a tabela narrativas
    const { error: updateError } = await supabase
      .from("narrativas")
      .update({ audio_url: publicUrl })
      .eq("id", narrativa_id);

    if (updateError) {
      console.error("Erro ao atualizar narrativa com audio_url:", updateError);
    }

    return res.json({
      success: true,
      audio_url: publicUrl,
    });
  } catch (error: any) {
    console.error("Erro na geração de áudio:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Erro interno na geração de áudio" });
  }
});

const ManualEditSchema = z.object({
  memorial_id: z.string().uuid(),
  conteudo_completo: z.string().max(20000),
  narrativa_id: z.string().uuid(),
});

// Rota para salvar edicao manual
app.post("/api/narrativas/manual_edit", aiLimiter, async (req, res) => {
  try {
    const parseResult = ManualEditSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res
        .status(400)
        .json({
          error: "Dados inválidos",
          details: parseResult.error.format(),
        });
    }
    const { memorial_id, conteudo_completo, narrativa_id } = parseResult.data;

    if (!memorial_id || !conteudo_completo || !narrativa_id) {
      return res
        .status(400)
        .json({ error: "Dados insuficientes para edição manual" });
    }

    let supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res
        .status(500)
        .json({
          error: "SUPABASE URL ou SERVICE ROLE KEY não configurada no .env",
        });
    }

    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const user = await requireAuthAndOwnership(req, res, memorial_id, supabase);
    if (!user) return; // Response já enviada

    const { data: narrativa, error: narrativaError } = await supabase
      .from("narrativas")
      .update({
        conteudo_completo: conteudo_completo,
        modo_conteudo: "editado_pelo_usuario",
      })
      .eq("id", narrativa_id)
      .select()
      .single();

    if (narrativaError) {
      console.error(
        "Erro ao salvar narrativa editada manualmente:",
        narrativaError,
      );
      return res.status(500).json({ error: "Erro ao salvar narrativa" });
    }

    await supabase.from("eventos_geracao").insert({
      memorial_id,
      narrativa_id: narrativa.id,
      motivo_geracao: "edicao_manual",
    });

    return res.json({
      success: true,
    });
  } catch (error: any) {
    console.error("Erro na edicao manual:", error);
    return res
      .status(500)
      .json({ error: error?.message || "Erro interno na edicao manual" });
  }
});

// Middleware global para tratamento de erros e evitar que o Express retorne HTML em erros não tratados
app.use((err: any, req: any, res: any, next: any) => {
  console.error("Erro interno não tratado no Express (API):", err);
  res.status(500).json({
    success: false,
    error: err.message || "Erro interno do servidor",
    details: err.stack || String(err),
  });
});

export default app;

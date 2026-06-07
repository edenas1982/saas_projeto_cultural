# NÚCLEO: Projeto Cultural
> Escopo: tudo que é B2C, emocional e público. Famílias, memoriais, quiz, narrativa, áudio, QR Code, portal público.
> Pastas de trabalho: `/src/pages/projeto-cultural`, `/src/components/projeto-cultural`
> Para regras globais de stack, segurança e separação de escopos → consulte `MASTER_AGENT.md`

---

## 1. IDENTIDADE DO NÚCLEO

O Projeto Cultural é o coração emocional da plataforma. O usuário final é uma família em luto. O design e a linguagem devem ser **minimalistas, elegantes e humanos** — sem jargões técnicos, sem elementos de rede social, sem elementos de gamificação.

---

## 2. DOCUMENTO DE DOMÍNIO (obrigatório em todo prompt de IA)

Todo prompt enviado para geração narrativa deve carregar este vocabulário:

- **Fato**: dado verificável e datável. Nascimento, profissão, cidade. São as coordenadas da vida.
- **Memória**: dado que gera presença sensorial ou emocional. Cheiro, hábito, frase, ritual. Nunca apenas factual.
- **Tag semântica**: traço psicológico dominante inferido pela IA (contemplação, humor, disciplina).
- **Densidade**: profundidade do material disponível, não apenas quantidade de respostas.
- **Narrativa**: produto final renderizado. Pode ser regenerada sem alterar os dados originais.
- **Perfil narrativo**: parâmetros de tom, ritmo, formalidade e expansividade.

**Regras de geração (invioláveis):**
- Nunca inventar detalhes não fornecidos.
- Nunca dramatizar a morte excessivamente.
- Sem religiosidade inventada.
- Priorizar memórias concretas e sensoriais.

---

## 3. OS 4 PILARES NARRATIVOS (AS GAVETAS)

| Gaveta | Nome | Foco |
|---|---|---|
| 1 | Identidade — A Raiz | Origens, nascimento, linhagem |
| 2 | Jornada — O Tronco | Trajetória, profissão, família |
| 3 | Essência — A Seiva | Hábitos, rituais, detalhes sensoriais |
| 4 | Legado — Os Frutos | Ensinamentos, frases, impacto nas pessoas |

20 perguntas no total. 12 obrigatórias (Memorial Mínimo). 20 completas (Memorial Documental).

---

## 4. FLUXO PRINCIPAL

```
Cadastro → Criação do memorial → Quiz 4 gavetas → Configuração de tom/voz
→ [Aviso de imprecisão + opt-in obrigatório] → Geração da narrativa (Claude primário / Gemini fallback)
→ Curadoria afetiva (editar / refinar / próprio punho)
→ Geração de áudio (TTS Google) → Geração do QR Code
→ Portal público
```

**Regras críticas do fluxo:**
- `consentimento_uso = true` antes de qualquer geração.
- `confirmado_pelo_usuario = true` antes de gerar QR Code.
- IA nunca é acionada em acesso via QR Code — tudo servido do Storage.
- Status `rascunho` e `gerado` nunca visíveis para outros usuários. Apenas `público` é aberto.

---

## 5. TELA PÚBLICA (PORTAL / LÁPIDE)

Acesso mobile. Ordem dos elementos:
1. Foto em destaque
2. Nome, datas, cidade
3. Player de áudio (narração gerada)
4. Texto biográfico resumido + botão "Ler tudo"
5. Carrossel de fotos (até 10)
6. Diário de condolências (mensagens de visitantes)

Moderação de mensagens: aprovação manual pelo dono do memorial.

---

## 6. REGRAS DE NEGÓCIO ESPECÍFICAS DESTE NÚCLEO

- Autorizações e certidões → bucket **privado**, manipuladas exclusivamente no backend.
- Documentos OCR (certidão de óbito): Google Vision API ou Tesseract.
- QR Code permanente (lápide) vs temporário (velório) → tratados com status distintos.
- Busca pública: apenas memoriais com flag `público = true` aparecem no portal de busca.

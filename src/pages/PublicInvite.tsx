import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Send, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function PublicInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [invite, setInvite] = useState<any>(null);
  const [memorial, setMemorial] = useState<any>(null);
  const [perguntas, setPerguntas] = useState<any[]>([]);
  const [respostas, setRespostas] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadInvite() {
      try {
        const res = await fetch(`/api/public/invite/${token}`);
        
        const contentType = res.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw new Error(`Servidor retornou formato inválido (HTML). Código: ${res.status}`);
        }

        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Convite inválido ou expirado.');
        }

        setInvite(data.invite);
        setMemorial(data.memorial);
        setPerguntas(data.perguntas);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    loadInvite();
  }, [token]);

  const handleSubmit = async () => {
    // Collect answers
    const answersToSubmit = perguntas.map(p => ({
      pergunta_id: p.id,
      resposta: respostas[p.id] || '',
      pergunta_texto_snapshot: p.texto_pergunta,
      gaveta_snapshot: p.gaveta,
      opcional: !p.obrigatoria
    })).filter(r => r.resposta.trim() !== '');

    if (answersToSubmit.length === 0) {
      alert("Por favor, preencha pelo menos uma resposta antes de enviar.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/invite/${token}/respostas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ respostas: answersToSubmit })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error(`Servidor retornou um erro inesperado (HTML). Código: ${res.status}`);
      }

      const data = await res.json();
      if (!res.ok) {
         console.error("Backend error details:", data.details);
         throw new Error(data.details ? `${data.error} - ${data.details}` : (data.error || 'Erro ao enviar respostas.'));
      }

      setSuccess(true);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTestFill = () => {
    const testData = [
      "Um homem de poucas palavras, mas de um coração gigante, trabalhador incansável e o grande porto seguro da nossa família.",
      "Antônio Alves da Silva. Nasceu em uma fazenda pequena no interior de Minas Gerais, perto de Poços de Caldas.",
      "Nasceu em 1945. Cresceu na roça, sem energia elétrica no começo, brincando no quintal de terra batida entre os pés de café.",
      "Filho do 'Seu' João e da Dona Maria, lavradores que vieram de carroça do interior de São Paulo em busca de terra boa.",
      "Chamavam ele de 'Tonho Ventania' porque não parava quieto, sempre correndo para ajudar o pai na roça.",
      "Foi marceneiro a vida inteira. Tinha as mãos grossas, mas um cuidado de artista para fazer móveis perfeitos.",
      "Casou-se com a Dona Helena, o amor da vida dele. Ficaram juntos por 50 anos e tiveram 4 filhos e 9 netos.",
      "A casinha com varanda que ele comprou com muito suor em Campinas, interior de São Paulo.",
      "Quando teve coragem de largar o emprego na fábrica para abrir a própria marcenaria na garagem de casa. Passou aperto, mas venceu.",
      "Não era de falar muito. O jeito dele amar era consertar as coisas quebradas na casa dos filhos e fazer brinquedos de madeira para os netos.",
      "Cheiro de pó de serra misturado com café forte passado na hora.",
      "Macarronada com frango assado com a casa cheia, seguida do cochilo sagrado no sofá com o jogo de futebol na TV.",
      "Sentar na cadeira de fio na calçada no fim da tarde, escutando rádio AM bem baixinho.",
      "Guardava parafusos e pregos velhos em potes de margarina dizendo 'um dia vai servir' (e sempre servia).",
      "Era o conselheiro quieto. Ele escutava todo mundo e só falava quando era para dar uma palavra de sabedoria.",
      "'Deus não dá um fardo maior do que a gente tem força para carregar.'",
      "Que o trabalho honesto é a nossa maior riqueza e que a família deve sempre sentar unida na mesa, não importam as brigas.",
      "A vez que ele tentou fazer um bolo surpresa para a Helena e confundiu o sal com o açúcar. O bolo ficou horrível, mas comemos tudo de tanto orgulho dele.",
      "Após uma vida longa e de muito trabalho, ele partiu de forma tranquila após um infarto, dormindo na sua cadeira favorita na varanda.",
      "'Não chorem porque fui embora, fiquem felizes pelas coisas lindas que vivemos. Cuidem bem da mãe de vocês.'"
    ];

    const sortedPerguntas = [...perguntas].sort((a, b) => a.ordem - b.ordem);
    const newRespostas = { ...respostas };
    
    sortedPerguntas.forEach((p, index) => {
      if (index < testData.length) {
        newRespostas[p.id] = testData[index];
      }
    });
    
    setRespostas(newRespostas);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-gray-500 font-medium">Acessando covite seguro...</p>
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border p-8 text-center">
          <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Clock size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link Indisponível</h2>
          <p className="text-gray-600 mb-6">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border p-8 text-center">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Obrigado, {invite.destinatario_nome}!</h2>
          <p className="text-gray-600">
            Suas lembranças foram enviadas de forma segura e anexadas ao memorial de <strong>{memorial?.nome_homenageado}</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-gray-900 font-sans selection:bg-emerald-200">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-serif text-emerald-800">Ecos de Memória</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-2">Olá, {invite.destinatario_nome}.</h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            Você foi convidado(a) para ajudar a construir o memorial de <strong>{memorial?.nome_homenageado}</strong>. 
            Abaixo estão algumas perguntas separadas especialmente para você. Fique à vontade para escrever com suas próprias palavras.
          </p>
        </div>

        <div className="space-y-6">
          {perguntas.map((p, idx) => (
            <div key={p.id} className="bg-white rounded-2xl shadow-sm border p-6 md:p-8 transition-shadow focus-within:ring-2 focus-within:ring-emerald-500 focus-within:ring-opacity-50">
              <label htmlFor={`pergunta-${p.id}`} className="block">
                <span className="text-sm font-medium tracking-wider text-emerald-700 uppercase mb-2 block">{p.gaveta}</span>
                <span className="text-xl font-medium text-gray-900 block mb-2">{idx + 1}. {p.texto_pergunta}</span>
                {p.dica && <span className="text-sm text-gray-500 block mb-4 italic">{p.dica}</span>}
              </label>
              <textarea
                id={`pergunta-${p.id}`}
                value={respostas[p.id] || ''}
                onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })}
                placeholder="Escreva sua lembrança aqui..."
                rows={4}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 focus:bg-white focus:outline-none focus:ring-0 focus:border-emerald-500 transition-colors resize-y min-h-[120px] text-gray-800 text-lg"
              ></textarea>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <button 
             onClick={handleTestFill}
             className="bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200 px-4 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors"
             title="Botão temporário! Informar Gerente (deve ser removido depois)"
          >
             🪄 [DEV] AUTO-PREENCHER
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-emerald-700 text-white px-8 py-4 rounded-xl font-medium hover:bg-emerald-800 active:bg-emerald-900 transition flex items-center justify-center gap-2 w-full md:w-auto shadow-lg shadow-emerald-700/20 disabled:opacity-70 disabled:cursor-wait text-lg"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Enviando...
              </span>
            ) : (
              <>
                <Send size={20} />
                Enviar Lembranças
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

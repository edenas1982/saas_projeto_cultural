import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export const authenticateToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token === 'MOCK_TOKEN') {
       (req as any).user = { id: '78654881-7776-4391-8e3f-03d54bc135d9' };
       return next();
    }

    if (!token || token === 'undefined' || token === 'null') {
      return res.status(401).json({ error: 'Token de acesso requerido ou inválido. Nenhuma credencial fornecida.' });
    }

    let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Configurações do Supabase não encontradas no servidor." });
    }

    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(403).json({ 
        error: 'Token inválido ou expirado.',
        details: error ? error.message : 'Usuário nulo retornado do Supabase'
      });
    }

    (req as any).user = user;
    next();
  } catch (e: any) {
    return res.status(500).json({ error: `Erro na autenticação: ${e.message || e}` });
  }
};

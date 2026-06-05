import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  walletBalance: number;
  setWalletBalance: (val: number) => void;
  refreshWallet: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  walletBalance: 40.00,
  setWalletBalance: () => {},
  refreshWallet: async () => {}
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number>(40.00);

  const initWallet = (usr: User | null) => {
    if (usr) {
      const balance = usr.user_metadata?.wallet_balance;
      setWalletBalance(typeof balance === 'number' ? balance : 40.00);
    } else {
      setWalletBalance(40.00);
    }
  };

  useEffect(() => {
    // Busca a sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      initWallet(session?.user ?? null);
      setLoading(false);
      
      // Busca dados mais recentes do servidor para atualizar cache (user_metadata)
      if (session) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            setUser(user);
            initWallet(user);
          }
        });
      }
    });

    // Escuta mudanças de auth (login, logout, token refresh, password recovery)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      initWallet(session?.user ?? null);
      setLoading(false);
      
      // Garante que logo após o sign in pegue o metadata fresco
      if (session && event === 'SIGNED_IN') {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            setUser(user);
            initWallet(user);
          }
        });
      }
      
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/atualizar-senha';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshWallet = async () => {
    try {
      const { data: sessionData } = await supabase.auth.refreshSession();
      if (sessionData?.session?.user) {
         initWallet(sessionData.session.user);
      }
    } catch (e) {
      console.error(e);
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut, walletBalance, setWalletBalance, refreshWallet }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

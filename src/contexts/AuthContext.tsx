import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, fetchServer } from '../utils/supabase/client';
import { Session, User } from '@supabase/supabase-js';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  tipo_usuario: 'admin' | 'producao' | 'motorista' | 'vendas' | 'cliente';
  avatar_url?: string;
  ativo: boolean;
  created_at?: string;
}

interface AuthContextData {
  user: User | null;
  usuario: Usuario | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão inicial
    void checkSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      void handleAuthStateChange(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleAuthStateChange(session: Session | null) {
    setUser(session?.user ?? null);
    setLoading(true);

    try {
      if (session?.user) {
        await loadUserData(session.user, session.access_token);
      } else {
        setUsuario(null);
      }
    } finally {
      setLoading(false);
    }
  }

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadUserData(session.user, session.access_token);
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserData(sessionUser?: User, accessToken?: string) {
    try {
      const { user: userData } = await fetchServer('/me', {}, accessToken);
      setUsuario(userData);
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
      const fallbackUser = sessionUser || user;
      if (fallbackUser) {
        const tipoUsuario = (fallbackUser.user_metadata?.tipo_usuario || 'cliente').toLowerCase();
        const allowed = ['admin', 'producao', 'motorista', 'vendas', 'cliente'];
        const safeTipo = allowed.includes(tipoUsuario) ? tipoUsuario : 'cliente';

        setUsuario({
          id: fallbackUser.id,
          nome: fallbackUser.user_metadata?.nome || fallbackUser.email?.split('@')[0] || 'Usuário',
          email: fallbackUser.email || '',
          tipo_usuario: safeTipo as Usuario['tipo_usuario'],
          ativo: true,
        });
      }
    }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setUsuario(null);
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  }

  async function refreshUser() {
    await loadUserData();
  }

  return (
    <AuthContext.Provider value={{ user, usuario, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context;
}

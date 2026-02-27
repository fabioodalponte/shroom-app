import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, fetchServer } from '../utils/supabase/client';
import { User } from '@supabase/supabase-js';

interface Usuario {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  tipo_usuario: 'admin' | 'producao' | 'motorista' | 'vendas' | 'cliente';
  avatar_url?: string;
  ativo: boolean;
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
    checkSession();

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadUserData();
      } else {
        setUsuario(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkSession() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      
      if (session?.user) {
        await loadUserData();
      }
    } catch (error) {
      console.error('Erro ao verificar sessão:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadUserData() {
    try {
      const { user: userData } = await fetchServer('/me');
      setUsuario(userData);
    } catch (error) {
      console.error('Erro ao carregar dados do usuário:', error);
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

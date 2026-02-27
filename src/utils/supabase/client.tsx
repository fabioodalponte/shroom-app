import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Cliente Supabase para uso no frontend
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// URL base do servidor
export const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5522cecf`;

/**
 * Helper para fazer chamadas autenticadas ao servidor
 */
export async function fetchServer(endpoint: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || publicAnonKey;

  const response = await fetch(`${SERVER_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('❌ Erro na requisição:', {
      endpoint,
      status: response.status,
      error,
      body: options.body
    });
    throw new Error(error.error || 'Erro na requisição');
  }

  return response.json();
}
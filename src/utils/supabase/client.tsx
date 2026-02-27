import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Cliente Supabase para uso no frontend
export const supabase = createClient(
  `https://${projectId}.supabase.co`,
  publicAnonKey
);

// URL base do servidor
export const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-5522cecf`;
const REQUEST_TIMEOUT_MS = 15000;

/**
 * Helper para fazer chamadas autenticadas ao servidor
 */
export async function fetchServer(endpoint: string, options: RequestInit = {}, accessToken?: string) {
  const token = accessToken || (await supabase.auth.getSession()).data.session?.access_token || publicAnonKey;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${SERVER_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      let error: any = {};
      try {
        error = await response.json();
      } catch {
        error = { error: await response.text() };
      }
      console.error('❌ Erro na requisição:', {
        endpoint,
        status: response.status,
        error,
        body: options.body
      });
      throw new Error(error.error || `Erro na requisição (${response.status})`);
    }

    return response.json();
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo limite excedido ao conectar com o servidor');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

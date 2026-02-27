import { useState, useCallback } from 'react';
import { fetchServer } from '../utils/supabase/client';
import { toast } from 'sonner@2.0.3';

interface UseApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
  showSuccessToast?: boolean;
  showErrorToast?: boolean;
  successMessage?: string;
}

export function useApi<T = any>(endpoint: string, options: UseApiOptions = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const {
    onSuccess,
    onError,
    showSuccessToast = false,
    showErrorToast = true,
    successMessage,
  } = options;

  const execute = useCallback(async (fetchOptions?: RequestInit, endpointOverride?: string) => {
    setLoading(true);
    setError(null);

    try {
      const requestEndpoint = endpointOverride || endpoint;
      const result = await fetchServer(requestEndpoint, fetchOptions);
      setData(result);

      if (showSuccessToast && successMessage) {
        toast.success(successMessage);
      }

      if (onSuccess) {
        onSuccess(result);
      }

      return result;

    } catch (err: any) {
      const error = err instanceof Error ? err : new Error(err.message || 'Erro desconhecido');
      setError(error);

      if (showErrorToast) {
        toast.error(error.message);
      }

      if (onError) {
        onError(error);
      }

      throw error;

    } finally {
      setLoading(false);
    }
  }, [endpoint, onSuccess, onError, showSuccessToast, showErrorToast, successMessage]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    data,
    loading,
    error,
    execute,
    reset,
  };
}

/**
 * Hook para operações de GET
 */
export function useGet<T = any>(endpoint: string, options?: UseApiOptions) {
  const api = useApi<T>(endpoint, options);

  const fetch = useCallback(async (queryParams?: Record<string, string>) => {
    const params = queryParams
      ? '?' + new URLSearchParams(queryParams).toString()
      : '';
    
    const requestEndpoint = `${endpoint}${params}`;
    return api.execute(undefined, requestEndpoint);
  }, [api, endpoint]);

  return { ...api, fetch };
}

/**
 * Hook para operações de POST
 */
export function usePost<T = any>(endpoint: string, options?: UseApiOptions) {
  const api = useApi<T>(endpoint, options);

  const post = useCallback(async (body: any) => {
    return api.execute({
      method: 'POST',
      body: JSON.stringify(body),
    });
  }, [api]);

  return { ...api, post };
}

/**
 * Hook para operações de PUT
 */
export function usePut<T = any>(endpoint: string, options?: UseApiOptions) {
  const api = useApi<T>(endpoint, options);

  const put = useCallback(async (body: any) => {
    return api.execute({
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }, [api]);

  return { ...api, put };
}

/**
 * Hook para operações de DELETE
 */
export function useDelete<T = any>(endpoint: string, options?: UseApiOptions) {
  const api = useApi<T>(endpoint, options);

  const del = useCallback(async () => {
    return api.execute({
      method: 'DELETE',
    });
  }, [api]);

  return { ...api, delete: del };
}

/**
 * Hook para operações de PATCH
 */
export function usePatch<T = any>(endpoint: string, options?: UseApiOptions) {
  const api = useApi<T>(endpoint, options);

  const patch = useCallback(async (body: any) => {
    return api.execute({
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }, [api]);

  return { ...api, patch };
}

/**
 * Hooks específicos para entidades do Shroom Bros
 */

// Lotes
export function useLotes() {
  return useGet('/lotes');
}

export function useCreateLote() {
  return usePost('/lotes', {
    showSuccessToast: true,
    successMessage: 'Lote criado com sucesso!',
  });
}

export function useUpdateLote(id: string) {
  return usePut(`/lotes/${id}`, {
    showSuccessToast: true,
    successMessage: 'Lote atualizado com sucesso!',
  });
}

// Colheitas
export function useColheitas() {
  return useGet('/colheitas');
}

export function useCreateColheita() {
  return usePost('/colheitas', {
    showSuccessToast: true,
    successMessage: 'Colheita registrada com sucesso!',
  });
}

// Estoque
export function useEstoque() {
  return useGet('/estoque');
}

// Produtos
export function useProdutos() {
  return useGet('/produtos');
}

// Clientes
export function useClientes() {
  return useGet('/clientes');
}

export function useCreateCliente() {
  return usePost('/clientes', {
    showSuccessToast: true,
    successMessage: 'Cliente cadastrado com sucesso!',
  });
}

// Pedidos
export function usePedidos() {
  return useGet('/pedidos');
}

export function useCreatePedido() {
  return usePost('/pedidos', {
    showSuccessToast: true,
    successMessage: 'Pedido criado com sucesso!',
  });
}

export function useUpdatePedidoStatus(id: string) {
  return usePut(`/pedidos/${id}/status`, {
    showSuccessToast: true,
    successMessage: 'Status atualizado!',
  });
}

// Entregas
export function useEntregas() {
  return useGet('/entregas');
}

export function useCreateEntrega() {
  return usePost('/entregas', {
    showSuccessToast: true,
    successMessage: 'Entrega criada com sucesso!',
  });
}

export function useUpdateEntrega(id: string) {
  return usePut(`/entregas/${id}`, {
    showSuccessToast: true,
    successMessage: 'Entrega atualizada!',
  });
}

// Financeiro
export function useFinanceiro() {
  return useGet('/financeiro');
}

export function useCreateTransacao() {
  return usePost('/financeiro', {
    showSuccessToast: true,
    successMessage: 'Transação registrada!',
  });
}

// Câmeras
export function useCameras() {
  return useGet('/cameras');
}

// Usuários
export function useUsuarios() {
  return useGet('/usuarios');
}

// Rotas e Logística
export function useMotoristas() {
  return useGet('/motoristas');
}

export function useCreateMotorista() {
  return usePost('/motoristas', {
    showSuccessToast: true,
    successMessage: 'Motorista cadastrado com sucesso!',
  });
}

export function useUpdateMotorista(id: string) {
  return usePut(`/motoristas/${id}`, {
    showSuccessToast: true,
    successMessage: 'Motorista atualizado!',
  });
}

export function useDeleteMotorista(id: string) {
  return useDelete(`/motoristas/${id}`, {
    showSuccessToast: true,
    successMessage: 'Motorista removido!',
  });
}

export function useRotas() {
  return useGet('/rotas');
}

export function useSugestoesRotas() {
  return useGet('/rotas/sugestoes');
}

export function useCreateRota() {
  return usePost('/rotas', {
    showSuccessToast: true,
    successMessage: 'Rota criada com sucesso!',
  });
}

export function useIniciarRota(id: string) {
  return usePatch(`/rotas/${id}/iniciar`, {
    showSuccessToast: true,
    successMessage: 'Rota iniciada!',
  });
}

export function useFinalizarRota(id: string) {
  return usePatch(`/rotas/${id}/finalizar`, {
    showSuccessToast: true,
    successMessage: 'Rota finalizada!',
  });
}

export function useCancelarRota(id: string) {
  return usePatch(`/rotas/${id}/cancelar`, {
    showSuccessToast: true,
    successMessage: 'Rota cancelada!',
  });
}

export function useAtualizarParada(id: string) {
  return usePatch(`/paradas/${id}`, {
    showSuccessToast: true,
    successMessage: 'Parada atualizada!',
  });
}

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { fetchServer } from '../../utils/supabase/client';
import { useAuth } from '../../contexts/AuthContext';

export function Debug() {
  const { usuario } = useAuth();
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const testProdutos = async () => {
    try {
      setLoading(true);
      addLog('🔍 Buscando produtos...');
      const result = await fetchServer('/produtos');
      addLog(`✅ Produtos encontrados: ${result.produtos?.length || 0}`);
      console.log('Produtos:', result);
    } catch (error: any) {
      addLog(`❌ Erro ao buscar produtos: ${error.message}`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const testCreateLote = async () => {
    try {
      setLoading(true);
      addLog('🔍 Buscando produtos...');
      const { produtos } = await fetchServer('/produtos');
      
      if (!produtos || produtos.length === 0) {
        addLog('❌ Nenhum produto cadastrado! Execute o SQL primeiro.');
        return;
      }

      const produto = produtos[0];
      addLog(`✅ Produto encontrado: ${produto.nome}`);
      addLog(`📝 Criando lote de teste...`);

      const loteData = {
        produto_id: produto.id,
        data_inicio: new Date().toISOString().split('T')[0],
        sala: 'Sala Teste',
        temperatura_atual: 20,
        umidade_atual: 85
      };

      addLog(`📤 Enviando: ${JSON.stringify(loteData, null, 2)}`);

      const result = await fetchServer('/lotes', {
        method: 'POST',
        body: JSON.stringify(loteData)
      });

      addLog(`✅ Lote criado com sucesso!`);
      addLog(`📦 Código do lote: ${result.lote?.codigo_lote}`);
      console.log('Lote criado:', result);

    } catch (error: any) {
      addLog(`❌ Erro ao criar lote: ${error.message}`);
      console.error('Erro completo:', error);
    } finally {
      setLoading(false);
    }
  };

  const testAuth = async () => {
    try {
      setLoading(true);
      addLog('🔍 Testando autenticação...');
      addLog(`👤 Usuário logado: ${usuario?.nome || 'Nenhum'}`);
      addLog(`📧 Email: ${usuario?.email || 'N/A'}`);
      addLog(`🆔 ID: ${usuario?.id || 'N/A'}`);
      
      if (!usuario) {
        addLog('❌ Você não está autenticado! Faça login primeiro.');
      } else {
        addLog('✅ Autenticação OK!');
      }
    } finally {
      setLoading(false);
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Debug & Testes
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Ferramentas de diagnóstico
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Testes Rápidos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              onClick={testAuth} 
              disabled={loading}
              variant="outline"
            >
              🔐 Testar Autenticação
            </Button>
            
            <Button 
              onClick={testProdutos} 
              disabled={loading}
              variant="outline"
            >
              📦 Testar Produtos
            </Button>

            <Button 
              onClick={testCreateLote} 
              disabled={loading}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              ✨ Criar Lote Teste
            </Button>
          </div>

          <Button 
            onClick={clearLogs} 
            variant="ghost"
            size="sm"
          >
            🗑️ Limpar Logs
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Console de Logs</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">Clique em um botão acima para começar os testes...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="mb-1">{log}</div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <CardTitle>ℹ️ Instruções</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-semibold">1. Testar Autenticação</p>
            <p className="text-gray-600">Verifica se você está logado corretamente</p>
          </div>
          
          <div>
            <p className="font-semibold">2. Testar Produtos</p>
            <p className="text-gray-600">Verifica se os produtos foram inseridos no banco (você precisa executar o SQL primeiro)</p>
          </div>

          <div>
            <p className="font-semibold">3. Criar Lote Teste</p>
            <p className="text-gray-600">Cria um lote de teste automaticamente para verificar se tudo está funcionando</p>
          </div>

          <div className="mt-4 p-3 bg-yellow-50 rounded border border-yellow-200">
            <p className="font-semibold text-yellow-800">⚠️ Antes de usar:</p>
            <p className="text-yellow-700">Certifique-se de que você executou o SQL no Supabase Dashboard!</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

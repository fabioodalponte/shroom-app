# 📘 Exemplos Práticos de Uso da API - Shroom Bros

## 🎯 Como Integrar Dados Reais nas Páginas

Este guia mostra exemplos práticos de como usar os hooks customizados e a API do Supabase nas páginas existentes do app Shroom Bros.

---

## 1️⃣ PÁGINA DE LOTES

### **Listar Lotes**

```typescript
import { useEffect } from 'react';
import { useLotes } from '../../hooks/useApi';
import { Loader2 } from 'lucide-react';

export function Lotes() {
  const { data, loading, error, fetch } = useLotes();

  useEffect(() => {
    fetch(); // Buscar lotes ao carregar
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600">Erro: {error.message}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1>Lotes de Produção</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data?.lotes.map((lote) => (
          <LoteCard key={lote.id} lote={lote} />
        ))}
      </div>
    </div>
  );
}
```

### **Criar Novo Lote**

```typescript
import { useCreateLote } from '../../hooks/useApi';
import { useState } from 'react';

export function CreateLote() {
  const { loading, post } = useCreateLote();
  const [formData, setFormData] = useState({
    codigo_lote: '',
    produto_id: '',
    data_inicio: '',
    quantidade_inicial: 0,
    sala: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await post({
        ...formData,
        status: 'Em Cultivo',
      });
      
      // Redirecionar ou limpar form
      navigate('/lotes');
      
    } catch (error) {
      // Erro já é tratado pelo hook
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Seus campos do formulário */}
      
      <Button type="submit" disabled={loading}>
        {loading ? 'Criando...' : 'Criar Lote'}
      </Button>
    </form>
  );
}
```

### **Filtrar Lotes por Status**

```typescript
import { fetchServer } from '../../utils/supabase/client';

export function LotesFiltrados() {
  const [lotes, setLotes] = useState([]);
  const [status, setStatus] = useState('Em Cultivo');

  useEffect(() => {
    loadLotes();
  }, [status]);

  async function loadLotes() {
    try {
      const data = await fetchServer(`/lotes?status=${status}`);
      setLotes(data.lotes);
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="Em Cultivo">Em Cultivo</option>
        <option value="Pronto">Pronto</option>
        <option value="Colhido">Colhido</option>
      </select>

      {lotes.map(lote => <LoteCard key={lote.id} lote={lote} />)}
    </div>
  );
}
```

---

## 2️⃣ PÁGINA DE COLHEITA

### **Registrar Colheita**

```typescript
import { useCreateColheita, useLotes, useProdutos } from '../../hooks/useApi';

export function RegistrarColheita() {
  const { post, loading } = useCreateColheita();
  const { data: lotesData, fetch: fetchLotes } = useLotes();
  const { data: produtosData, fetch: fetchProdutos } = useProdutos();

  useEffect(() => {
    fetchLotes();
    fetchProdutos();
  }, []);

  const handleSubmit = async (formData) => {
    try {
      await post({
        lote_id: formData.lote_id,
        produto_id: formData.produto_id,
        quantidade_kg: parseFloat(formData.quantidade),
        qualidade: formData.qualidade, // 'Premium', 'Padrão', 'Segunda'
        observacoes: formData.observacoes,
      });

      // Sucesso! Toast já exibido pelo hook
      navigate('/colheita');

    } catch (error) {
      // Erro já tratado
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select name="lote_id">
        {lotesData?.lotes
          .filter(l => l.status === 'Pronto')
          .map(lote => (
            <option key={lote.id} value={lote.id}>
              {lote.codigo_lote} - {lote.produto.nome}
            </option>
          ))
        }
      </select>

      <select name="qualidade">
        <option value="Premium">Premium</option>
        <option value="Padrão">Padrão</option>
        <option value="Segunda">Segunda</option>
      </select>

      <input type="number" name="quantidade" step="0.01" />
      
      <Button type="submit" disabled={loading}>
        {loading ? 'Registrando...' : 'Registrar Colheita'}
      </Button>
    </form>
  );
}
```

### **Listar Colheitas com Detalhes**

```typescript
import { useColheitas } from '../../hooks/useApi';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function Colheita() {
  const { data, loading, fetch } = useColheitas();

  useEffect(() => {
    fetch();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h1>Histórico de Colheitas</h1>

      {data?.colheitas.map((colheita) => (
        <Card key={colheita.id}>
          <CardContent className="p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3>{colheita.lote.produto.nome}</h3>
                <p className="text-sm text-gray-500">
                  Lote: {colheita.lote.codigo_lote}
                </p>
                <p className="text-sm">
                  {format(new Date(colheita.data_colheita), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold">{colheita.quantidade_kg} kg</p>
                <Badge variant={
                  colheita.qualidade === 'Premium' ? 'default' : 
                  colheita.qualidade === 'Padrão' ? 'secondary' : 
                  'outline'
                }>
                  {colheita.qualidade}
                </Badge>
              </div>
            </div>

            {colheita.responsavel && (
              <p className="text-xs text-gray-500 mt-2">
                Por: {colheita.responsavel.nome}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## 3️⃣ PÁGINA DE VENDAS

### **Criar Novo Pedido**

```typescript
import { useCreatePedido, useClientes, useProdutos, useEstoque } from '../../hooks/useApi';
import { useState } from 'react';

export function NovoPedido() {
  const { post, loading } = useCreatePedido();
  const { data: clientesData, fetch: fetchClientes } = useClientes();
  const { data: produtosData, fetch: fetchProdutos } = useProdutos();
  
  const [itens, setItens] = useState([
    { produto_id: '', quantidade_kg: 0, preco_unitario: 0 }
  ]);

  useEffect(() => {
    fetchClientes();
    fetchProdutos();
  }, []);

  const addItem = () => {
    setItens([...itens, { produto_id: '', quantidade_kg: 0, preco_unitario: 0 }]);
  };

  const handleSubmit = async (formData) => {
    try {
      await post({
        cliente_id: formData.cliente_id,
        tipo_pedido: formData.tipo_pedido, // 'B2B' ou 'B2C'
        data_entrega_prevista: formData.data_entrega,
        itens: itens.map(item => ({
          produto_id: item.produto_id,
          quantidade_kg: parseFloat(item.quantidade_kg),
          preco_unitario: parseFloat(item.preco_unitario),
        })),
      });

      // Sucesso! Pedido criado
      navigate('/vendas');

    } catch (error) {
      console.error(error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <select name="cliente_id">
        {clientesData?.clientes.map(cliente => (
          <option key={cliente.id} value={cliente.id}>
            {cliente.nome} ({cliente.tipo_cliente})
          </option>
        ))}
      </select>

      <select name="tipo_pedido">
        <option value="B2B">B2B - Restaurante</option>
        <option value="B2C">B2C - Consumidor Final</option>
      </select>

      <input type="date" name="data_entrega" />

      {/* Itens do Pedido */}
      {itens.map((item, index) => (
        <div key={index} className="flex gap-4">
          <select
            value={item.produto_id}
            onChange={(e) => {
              const newItens = [...itens];
              newItens[index].produto_id = e.target.value;
              
              // Preencher preço automaticamente
              const produto = produtosData?.produtos.find(p => p.id === e.target.value);
              if (produto) {
                newItens[index].preco_unitario = produto.preco_kg;
              }
              
              setItens(newItens);
            }}
          >
            <option value="">Selecione o produto</option>
            {produtosData?.produtos.map(produto => (
              <option key={produto.id} value={produto.id}>
                {produto.nome} - R$ {produto.preco_kg}/kg
              </option>
            ))}
          </select>

          <input
            type="number"
            placeholder="Quantidade (kg)"
            value={item.quantidade_kg}
            onChange={(e) => {
              const newItens = [...itens];
              newItens[index].quantidade_kg = parseFloat(e.target.value);
              setItens(newItens);
            }}
          />

          <input
            type="number"
            placeholder="Preço/kg"
            value={item.preco_unitario}
            onChange={(e) => {
              const newItens = [...itens];
              newItens[index].preco_unitario = parseFloat(e.target.value);
              setItens(newItens);
            }}
          />
        </div>
      ))}

      <Button type="button" onClick={addItem}>
        Adicionar Item
      </Button>

      <Button type="submit" disabled={loading}>
        {loading ? 'Criando...' : 'Criar Pedido'}
      </Button>
    </form>
  );
}
```

### **Atualizar Status do Pedido**

```typescript
import { useUpdatePedidoStatus } from '../../hooks/useApi';

export function PedidoCard({ pedido, onUpdate }) {
  const { put, loading } = useUpdatePedidoStatus(pedido.id);

  const handleStatusChange = async (novoStatus: string) => {
    try {
      await put({ status: novoStatus });
      onUpdate(); // Recarregar lista
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Card>
      <CardContent>
        <h3>{pedido.numero_pedido}</h3>
        <p>{pedido.cliente.nome}</p>
        <p>R$ {pedido.valor_total.toFixed(2)}</p>

        <select
          value={pedido.status}
          onChange={(e) => handleStatusChange(e.target.value)}
          disabled={loading}
        >
          <option value="Pendente">Pendente</option>
          <option value="Confirmado">Confirmado</option>
          <option value="Preparando">Preparando</option>
          <option value="Pronto">Pronto</option>
          <option value="Em Rota">Em Rota</option>
          <option value="Entregue">Entregue</option>
          <option value="Cancelado">Cancelado</option>
        </select>
      </CardContent>
    </Card>
  );
}
```

---

## 4️⃣ PÁGINA DE LOGÍSTICA

### **Listar Entregas do Motorista**

```typescript
import { useAuth } from '../../contexts/AuthContext';
import { useEntregas } from '../../hooks/useApi';

export function MinhasEntregas() {
  const { usuario } = useAuth();
  const { data, loading, fetch } = useEntregas();

  useEffect(() => {
    if (usuario?.id) {
      // Buscar apenas entregas deste motorista
      fetchServer(`/entregas?motorista_id=${usuario.id}`)
        .then(result => setEntregas(result.entregas));
    }
  }, [usuario]);

  const entregasHoje = data?.entregas.filter(e => 
    isToday(new Date(e.data_saida))
  );

  return (
    <div>
      <h2>Minhas Entregas de Hoje</h2>
      {entregasHoje?.map(entrega => (
        <EntregaCard key={entrega.id} entrega={entrega} />
      ))}
    </div>
  );
}
```

### **Atualizar Status da Entrega**

```typescript
import { useUpdateEntrega } from '../../hooks/useApi';

export function EntregaCard({ entrega }) {
  const { put, loading } = useUpdateEntrega(entrega.id);

  const handleIniciarRota = async () => {
    await put({
      status: 'Em Rota',
      data_saida: new Date().toISOString(),
    });
  };

  const handleConcluir = async () => {
    await put({
      status: 'Entregue',
      data_entrega: new Date().toISOString(),
    });
  };

  return (
    <Card>
      <CardContent>
        <h3>{entrega.pedido.cliente.nome}</h3>
        <p>{entrega.endereco_entrega}</p>
        <p>Status: {entrega.status}</p>

        {entrega.status === 'Pendente' && (
          <Button onClick={handleIniciarRota} disabled={loading}>
            Iniciar Rota
          </Button>
        )}

        {entrega.status === 'Em Rota' && (
          <Button onClick={handleConcluir} disabled={loading}>
            Concluir Entrega
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
```

---

## 5️⃣ DASHBOARD COM DADOS REAIS

### **Métricas em Tempo Real**

```typescript
import { useLotes, usePedidos, useEstoque, useFinanceiro } from '../../hooks/useApi';

export function Dashboard() {
  const { data: lotesData } = useLotes();
  const { data: pedidosData } = usePedidos();
  const { data: estoqueData } = useEstoque();
  const { data: financeiroData } = useFinanceiro();

  useEffect(() => {
    // Carregar todos os dados
    fetchLotes();
    fetchPedidos();
    fetchEstoque();
    fetchFinanceiro();
  }, []);

  // Calcular métricas
  const lotesAtivos = lotesData?.lotes.filter(l => l.status === 'Em Cultivo').length || 0;
  const pedidosPendentes = pedidosData?.pedidos.filter(p => p.status !== 'Entregue').length || 0;
  const estoqueTotal = estoqueData?.estoque.reduce((sum, e) => sum + e.quantidade_kg, 0) || 0;
  
  const receitasMes = financeiroData?.transacoes
    .filter(t => t.tipo === 'Receita' && isThisMonth(new Date(t.data_transacao)))
    .reduce((sum, t) => sum + t.valor, 0) || 0;

  return (
    <div className="p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Lotes em Cultivo"
          value={lotesAtivos}
          icon={Sprout}
          trend="+12%"
        />

        <MetricCard
          title="Pedidos Pendentes"
          value={pedidosPendentes}
          icon={ShoppingCart}
          trend="+5%"
        />

        <MetricCard
          title="Estoque Total"
          value={`${estoqueTotal.toFixed(1)} kg`}
          icon={Package}
          trend="-8%"
        />

        <MetricCard
          title="Receita do Mês"
          value={`R$ ${receitasMes.toFixed(2)}`}
          icon={DollarSign}
          trend="+23%"
        />
      </div>
    </div>
  );
}
```

---

## 6️⃣ USANDO O HOOK useAuth

### **Acessar Dados do Usuário Logado**

```typescript
import { useAuth } from '../../contexts/AuthContext';

export function MeuComponente() {
  const { usuario, user, loading, signOut } = useAuth();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!usuario) {
    return <div>Não autenticado</div>;
  }

  return (
    <div>
      <h1>Olá, {usuario.nome}!</h1>
      <p>Tipo: {usuario.tipo_usuario}</p>
      <p>Email: {usuario.email}</p>

      {usuario.tipo_usuario === 'admin' && (
        <Button>Acessar Painel Admin</Button>
      )}

      <Button onClick={signOut}>Sair</Button>
    </div>
  );
}
```

### **Exibir Componentes Baseados em Permissões**

```typescript
export function MenuLateral() {
  const { usuario } = useAuth();

  return (
    <nav>
      <MenuItem to="/dashboard">Dashboard</MenuItem>

      {/* Todos podem ver */}
      <MenuItem to="/lotes">Lotes</MenuItem>

      {/* Apenas produção e admin */}
      {(usuario?.tipo_usuario === 'producao' || usuario?.tipo_usuario === 'admin') && (
        <MenuItem to="/colheita">Colheita</MenuItem>
      )}

      {/* Apenas vendas e admin */}
      {(usuario?.tipo_usuario === 'vendas' || usuario?.tipo_usuario === 'admin') && (
        <MenuItem to="/vendas">Vendas</MenuItem>
      )}

      {/* Apenas motoristas e admin */}
      {(usuario?.tipo_usuario === 'motorista' || usuario?.tipo_usuario === 'admin') && (
        <MenuItem to="/logistica">Logística</MenuItem>
      )}

      {/* Apenas admin */}
      {usuario?.tipo_usuario === 'admin' && (
        <>
          <MenuItem to="/financeiro">Financeiro</MenuItem>
          <MenuItem to="/seguranca">Segurança</MenuItem>
        </>
      )}
    </nav>
  );
}
```

---

## 7️⃣ TRABALHANDO COM RELACIONAMENTOS

### **Produto com Lotes Relacionados**

```typescript
export function ProdutoDetalhes({ produtoId }) {
  const [produto, setProduto] = useState(null);
  const [lotes, setLotes] = useState([]);

  useEffect(() => {
    loadData();
  }, [produtoId]);

  async function loadData() {
    // Buscar produto
    const { produtos } = await fetchServer('/produtos');
    const prod = produtos.find(p => p.id === produtoId);
    setProduto(prod);

    // Buscar lotes deste produto
    const { lotes: lotesData } = await fetchServer(`/lotes?produto_id=${produtoId}`);
    setLotes(lotesData);
  }

  return (
    <div>
      <h1>{produto?.nome}</h1>
      <p>{produto?.descricao}</p>

      <h2>Lotes Ativos</h2>
      {lotes.map(lote => (
        <LoteCard key={lote.id} lote={lote} />
      ))}
    </div>
  );
}
```

---

## 8️⃣ TRATAMENTO DE ERROS

### **Exemplo Completo com Tratamento**

```typescript
export function MinhaFuncao() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchServer('/lotes');
      setData(result.lotes);
    } catch (err) {
      setError(err.message);
      toast.error('Erro ao carregar lotes');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loader />;
  if (error) return <ErrorMessage message={error} onRetry={loadData} />;
  if (!data) return <EmptyState />;

  return <LotesList lotes={data} />;
}
```

---

## 💡 DICAS IMPORTANTES

### **1. Sempre use try/catch**
```typescript
try {
  await post(data);
} catch (error) {
  // Erro já mostrado pelo hook
  console.error(error);
}
```

### **2. Recarregar dados após modificações**
```typescript
const { fetch: reloadLotes } = useLotes();

const handleCreate = async (data) => {
  await createLote.post(data);
  reloadLotes(); // Recarregar lista
};
```

### **3. Usar loading states**
```typescript
<Button disabled={loading}>
  {loading ? (
    <>
      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      Salvando...
    </>
  ) : (
    'Salvar'
  )}
</Button>
```

### **4. Validar dados antes de enviar**
```typescript
const handleSubmit = async (formData) => {
  if (!formData.nome || !formData.email) {
    toast.error('Preencha todos os campos obrigatórios');
    return;
  }

  await post(formData);
};
```

---

**🍄 Pronto para integrar dados reais em todo o app Shroom Bros!**

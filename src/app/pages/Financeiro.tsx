import { useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, TrendingDown, Package, AlertCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFinanceiro } from '../../hooks/useApi';

interface Transacao {
  id: string;
  tipo: 'Receita' | 'Despesa';
  categoria: string;
  descricao?: string;
  valor: number | string;
  data_transacao: string;
  status?: 'Pendente' | 'Confirmado' | 'Cancelado';
  forma_pagamento?: string;
}

const CHART_COLORS = ['#546A4A', '#A88F52', '#3B2F28', '#1A1A1A', '#8B5E3C', '#6B7280'];

function toNumber(value: number | string | null | undefined) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isSameMonth(dateValue: string, month: number, year: number) {
  const date = new Date(dateValue);
  return date.getMonth() === month && date.getFullYear() === year;
}

export function Financeiro() {
  const { data, loading, error, fetch: fetchFinanceiro } = useFinanceiro();

  useEffect(() => {
    void fetchFinanceiro();
  }, [fetchFinanceiro]);

  const transacoes = useMemo(() => {
    return (data?.transacoes ?? []) as Transacao[];
  }, [data]);

  const transacoesAtivas = useMemo(() => {
    return transacoes.filter((transacao) => transacao.status !== 'Cancelado');
  }, [transacoes]);

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const receitasMes = useMemo(() => {
    return transacoesAtivas
      .filter((transacao) => transacao.tipo === 'Receita' && isSameMonth(transacao.data_transacao, currentMonth, currentYear))
      .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
  }, [transacoesAtivas, currentMonth, currentYear]);

  const despesasMes = useMemo(() => {
    return transacoesAtivas
      .filter((transacao) => transacao.tipo === 'Despesa' && isSameMonth(transacao.data_transacao, currentMonth, currentYear))
      .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
  }, [transacoesAtivas, currentMonth, currentYear]);

  const lucroMes = receitasMes - despesasMes;
  const margemMes = receitasMes > 0 ? (lucroMes / receitasMes) * 100 : 0;

  const totalReceitas = useMemo(() => {
    return transacoesAtivas
      .filter((transacao) => transacao.tipo === 'Receita')
      .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
  }, [transacoesAtivas]);

  const totalDespesas = useMemo(() => {
    return transacoesAtivas
      .filter((transacao) => transacao.tipo === 'Despesa')
      .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
  }, [transacoesAtivas]);

  const saldoAcumulado = totalReceitas - totalDespesas;

  const ticketMedioReceitaMes = useMemo(() => {
    const receitas = transacoesAtivas.filter(
      (transacao) => transacao.tipo === 'Receita' && isSameMonth(transacao.data_transacao, currentMonth, currentYear),
    );
    if (receitas.length === 0) return 0;
    return receitas.reduce((sum, transacao) => sum + toNumber(transacao.valor), 0) / receitas.length;
  }, [transacoesAtivas, currentMonth, currentYear]);

  const chartBaseDate = useMemo(() => new Date(currentYear, currentMonth, 1), [currentYear, currentMonth]);

  const transacoesPendentes = useMemo(() => {
    return transacoesAtivas.filter((transacao) => transacao.status === 'Pendente').length;
  }, [transacoesAtivas]);

  const receitaVsDespesa6Meses = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const monthDate = subMonths(chartBaseDate, 5 - index);
      const month = monthDate.getMonth();
      const year = monthDate.getFullYear();
      const transacoesMes = transacoesAtivas.filter((transacao) => isSameMonth(transacao.data_transacao, month, year));
      const receitas = transacoesMes
        .filter((transacao) => transacao.tipo === 'Receita')
        .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);
      const despesas = transacoesMes
        .filter((transacao) => transacao.tipo === 'Despesa')
        .reduce((sum, transacao) => sum + toNumber(transacao.valor), 0);

      return {
        month: format(monthDate, 'MMM/yy', { locale: ptBR }),
        receitas,
        despesas,
        saldo: receitas - despesas,
      };
    });
  }, [transacoesAtivas, chartBaseDate]);

  const despesasPorCategoriaMes = useMemo(() => {
    const mapa = new Map<string, number>();
    const despesasMesAtual = transacoesAtivas.filter(
      (transacao) => transacao.tipo === 'Despesa' && isSameMonth(transacao.data_transacao, currentMonth, currentYear),
    );

    for (const transacao of despesasMesAtual) {
      const categoria = transacao.categoria || 'Sem categoria';
      mapa.set(categoria, (mapa.get(categoria) ?? 0) + toNumber(transacao.valor));
    }

    return Array.from(mapa.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }))
      .sort((a, b) => b.value - a.value);
  }, [transacoesAtivas, currentMonth, currentYear]);

  const totalDespesasMesCategoria = despesasPorCategoriaMes.reduce((sum, item) => sum + item.value, 0);

  const transacoesRecentes = useMemo(() => {
    return [...transacoes]
      .sort((a, b) => new Date(b.data_transacao).getTime() - new Date(a.data_transacao).getTime())
      .slice(0, 12);
  }, [transacoes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Financeiro
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Análise de receitas, despesas e fluxo de caixa com dados reais
        </p>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-4 text-red-700 text-sm">
            Não foi possível carregar os dados financeiros: {error.message}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Receita (mês)</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {receitasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Despesas (mês)</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {despesasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Resultado (mês)</CardTitle>
            <DollarSign className="w-4 h-4 text-[#546A4A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {lucroMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className={`text-xs mt-1 ${margemMes >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Margem: {margemMes.toFixed(1)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Ticket médio (receita)</CardTitle>
            <Package className="w-4 h-4 text-[#A88F52]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {ticketMedioReceitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Receita x Despesa (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={receitaVsDespesa6Meses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <Line type="monotone" dataKey="receitas" stroke="#546A4A" strokeWidth={3} name="Receitas" />
                <Line type="monotone" dataKey="despesas" stroke="#C2410C" strokeWidth={3} name="Despesas" />
                <Line type="monotone" dataKey="saldo" stroke="#A88F52" strokeWidth={2} strokeDasharray="5 5" name="Saldo" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Despesas por Categoria (mês atual)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={
                    despesasPorCategoriaMes.length > 0
                      ? despesasPorCategoriaMes
                      : [{ name: 'Sem despesas no mês', value: 1, color: '#E3E3E3' }]
                  }
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  dataKey="value"
                >
                  {(despesasPorCategoriaMes.length > 0
                    ? despesasPorCategoriaMes
                    : [{ name: 'Sem despesas no mês', value: 1, color: '#E3E3E3' }]
                  ).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-[#546A4A] to-[#3B2F28] text-white">
        <CardHeader>
          <CardTitle className="text-white">Resumo Financeiro Acumulado</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm opacity-90 mb-2">Receita acumulada</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '30px', fontWeight: 700 }}>
              R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Despesa acumulada</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '30px', fontWeight: 700 }}>
              R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Saldo acumulado</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '30px', fontWeight: 700 }}>
              R$ {saldoAcumulado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Transações pendentes</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '30px', fontWeight: 700 }}>
              {transacoesPendentes}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#A88F52]" />
              Categorias de Despesa (mês atual)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {despesasPorCategoriaMes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma despesa registrada no mês atual.</p>
            ) : (
              <div className="space-y-3">
                {despesasPorCategoriaMes.map((item) => {
                  const percentage = totalDespesasMesCategoria > 0 ? (item.value / totalDespesasMesCategoria) * 100 : 0;
                  return (
                    <div key={item.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{item.name}</span>
                        <span>
                          R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          {' '}({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full h-2 bg-[#E3E3E3] rounded-full overflow-hidden">
                        <div className="h-full" style={{ width: `${percentage}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas Transações</CardTitle>
          </CardHeader>
          <CardContent>
            {transacoesRecentes.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma transação cadastrada.</p>
            ) : (
              <div className="space-y-3">
                {transacoesRecentes.map((transacao) => (
                  <div key={transacao.id} className="flex items-start justify-between p-3 rounded-lg bg-[#F8F6F2] border border-[#E3E3E3]">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className={transacao.tipo === 'Receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                          {transacao.tipo}
                        </Badge>
                        {transacao.status && (
                          <Badge variant="outline">{transacao.status}</Badge>
                        )}
                      </div>
                      <p className="text-sm font-medium mt-2">{transacao.categoria}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {format(new Date(transacao.data_transacao), 'dd/MM/yyyy', { locale: ptBR })}
                        {transacao.descricao ? ` • ${transacao.descricao}` : ''}
                      </p>
                    </div>
                    <span className={`text-sm font-semibold ${transacao.tipo === 'Receita' ? 'text-green-700' : 'text-red-700'}`}>
                      {transacao.tipo === 'Receita' ? '+' : '-'}R$ {toNumber(transacao.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

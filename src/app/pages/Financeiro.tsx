import { DollarSign, TrendingUp, TrendingDown, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useState } from 'react';

export function Financeiro() {
  const [selectedMonth, setSelectedMonth] = useState('Dez');

  const revenueData = [
    { month: 'Jul', revenue: 12500 },
    { month: 'Ago', revenue: 14200 },
    { month: 'Set', revenue: 15800 },
    { month: 'Out', revenue: 17500 },
    { month: 'Nov', revenue: 19200 },
    { month: 'Dez', revenue: 21000 },
  ];

  const costByLote = [
    { lote: 'LT-042', cost: 850, revenue: 1250, profit: 400 },
    { lote: 'LT-043', cost: 720, revenue: 1100, profit: 380 },
    { lote: 'LT-044', cost: 680, revenue: 950, profit: 270 },
    { lote: 'LT-041', cost: 900, revenue: 1350, profit: 450 },
  ];

  const expenseBreakdown = [
    { name: 'Substrato', value: 3500, color: '#546A4A' },
    { name: 'Energia', value: 2200, color: '#A88F52' },
    { name: 'Mão de Obra', value: 5800, color: '#1A1A1A' },
    { name: 'Embalagem', value: 1500, color: '#3B2F28' },
    { name: 'Logística', value: 2000, color: '#E3E3E3' },
  ];

  // Custos Fixos (mensais)
  const custosFixos = [
    { item: 'Aluguel / Instalações', valor: 3500, categoria: 'Infraestrutura' },
    { item: 'Salários Fixos (Fabio + André)', valor: 8000, categoria: 'Pessoal' },
    { item: 'Salários Equipe Administrativa', valor: 4500, categoria: 'Pessoal' },
    { item: 'Energia Base (mínima)', valor: 800, categoria: 'Utilidades' },
    { item: 'Internet / Telefonia', valor: 300, categoria: 'Utilidades' },
    { item: 'Seguros', valor: 450, categoria: 'Segurança' },
    { item: 'Licenças e Certificações', valor: 350, categoria: 'Legal' },
    { item: 'Manutenção Preventiva', valor: 600, categoria: 'Manutenção' },
    { item: 'Sistema de Gestão (software)', valor: 250, categoria: 'Tecnologia' },
    { item: 'Contabilidade', valor: 800, categoria: 'Administrativo' },
  ];

  // Custos Variáveis (por mês, baseado na produção)
  const custosVariaveis = [
    { item: 'Substrato (12 lotes)', valor: 3500, unidade: 'R$ 292/lote', categoria: 'Matéria-Prima' },
    { item: 'Spawn / Inóculo', valor: 1800, unidade: 'R$ 150/lote', categoria: 'Matéria-Prima' },
    { item: 'Energia Adicional (produção)', valor: 1400, unidade: 'R$ 117/lote', categoria: 'Utilidades' },
    { item: 'Água (processo)', valor: 450, unidade: 'R$ 38/lote', categoria: 'Utilidades' },
    { item: 'Embalagens (280 kg)', valor: 1500, unidade: 'R$ 5.36/kg', categoria: 'Embalagem' },
    { item: 'Etiquetas Premium', valor: 420, unidade: 'R$ 1.50/kg', categoria: 'Embalagem' },
    { item: 'Mão de Obra Variável', valor: 2200, unidade: 'Horas extras', categoria: 'Pessoal' },
    { item: 'Logística / Entregas', valor: 2000, unidade: '45 entregas', categoria: 'Distribuição' },
    { item: 'Materiais de Limpeza', valor: 380, unidade: 'R$ 32/lote', categoria: 'Higiene' },
    { item: 'Descartáveis (EPIs)', valor: 350, unidade: 'Consumo mensal', categoria: 'Segurança' },
  ];

  const totalCustosFixos = custosFixos.reduce((sum, item) => sum + item.valor, 0);
  const totalCustosVariaveis = custosVariaveis.reduce((sum, item) => sum + item.valor, 0);
  const totalCustos = totalCustosFixos + totalCustosVariaveis;

  // Dados para gráfico de Fixos vs Variáveis
  const fixosVsVariaveis = [
    { month: 'Jul', fixos: 19550, variaveis: 10200, total: 29750 },
    { month: 'Ago', fixos: 19550, variaveis: 11800, total: 31350 },
    { month: 'Set', fixos: 19550, variaveis: 12400, total: 31950 },
    { month: 'Out', fixos: 19550, variaveis: 13100, total: 32650 },
    { month: 'Nov', fixos: 19550, variaveis: 13650, total: 33200 },
    { month: 'Dez', fixos: 19550, variaveis: 14000, total: 33550 },
  ];

  // Ponto de Equilíbrio
  const receitaAtual = 21000;
  const producaoKg = 280;
  const precoMedioKg = receitaAtual / producaoKg; // R$ 75/kg
  const custoVariavelKg = totalCustosVariaveis / producaoKg; // R$ 50/kg
  const margemContribuicao = precoMedioKg - custoVariavelKg; // R$ 25/kg
  const pontoEquilibrioKg = totalCustosFixos / margemContribuicao; // kg necessários
  const pontoEquilibrioReais = pontoEquilibrioKg * precoMedioKg;

  // Distribuição Fixos vs Variáveis
  const fixosVsVariaveisPie = [
    { name: 'Custos Fixos', value: totalCustosFixos, color: '#3B2F28' },
    { name: 'Custos Variáveis', value: totalCustosVariaveis, color: '#A88F52' },
  ];

  const totalExpenses = expenseBreakdown.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
          Financeiro
        </h1>
        <p className="text-[#1A1A1A] opacity-70 mt-1">
          Análise de custos fixos, variáveis, receitas e lucratividade
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Receita (mês)</CardTitle>
            <TrendingUp className="w-4 h-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {receitaAtual.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-green-600 mt-1">+9.4% vs mês anterior</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Custos Totais</CardTitle>
            <TrendingDown className="w-4 h-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {totalCustos.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-red-600 mt-1">{((totalCustos / receitaAtual) * 100).toFixed(1)}% da receita</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Lucro Líquido</CardTitle>
            <DollarSign className="w-4 h-4 text-[#546A4A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {(receitaAtual - totalCustos).toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-green-600 mt-1">{(((receitaAtual - totalCustos) / receitaAtual) * 100).toFixed(1)}% margem</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Preço Médio/kg</CardTitle>
            <Package className="w-4 h-4 text-[#A88F52]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {precoMedioKg.toFixed(2)}
            </div>
            <p className="text-xs text-[#1A1A1A] opacity-70 mt-1">Shiitake Premium</p>
          </CardContent>
        </Card>
      </div>

      {/* Custos Fixos vs Variáveis - Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-2 border-[#3B2F28]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#3B2F28]" />
              Custos Fixos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '36px', fontWeight: 700, color: '#3B2F28' }}>
              R$ {totalCustosFixos.toLocaleString('pt-BR')}
            </div>
            <p className="text-sm text-[#1A1A1A] opacity-70 mt-2">
              Independente da produção
            </p>
            <p className="text-xs text-[#3B2F28] mt-1 font-semibold">
              {((totalCustosFixos / totalCustos) * 100).toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#A88F52]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#A88F52]" />
              Custos Variáveis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '36px', fontWeight: 700, color: '#A88F52' }}>
              R$ {totalCustosVariaveis.toLocaleString('pt-BR')}
            </div>
            <p className="text-sm text-[#1A1A1A] opacity-70 mt-2">
              Proporcional à produção
            </p>
            <p className="text-xs text-[#A88F52] mt-1 font-semibold">
              {((totalCustosVariaveis / totalCustos) * 100).toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>

        <Card className="border-2 border-[#546A4A] bg-[#546A4A] text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <CheckCircle className="w-5 h-5" />
              Margem de Contribuição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '36px', fontWeight: 700 }}>
              R$ {margemContribuicao.toFixed(2)}/kg
            </div>
            <p className="text-sm opacity-90 mt-2">
              Preço - Custo Variável
            </p>
            <p className="text-xs opacity-80 mt-1">
              {((margemContribuicao / precoMedioKg) * 100).toFixed(1)}% do preço de venda
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos - Fixos vs Variáveis e Distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolução Fixos vs Variáveis */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução: Custos Fixos vs Variáveis (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={fixosVsVariaveis}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="fixos" 
                  stroke="#3B2F28" 
                  strokeWidth={3}
                  name="Custos Fixos"
                />
                <Line 
                  type="monotone" 
                  dataKey="variaveis" 
                  stroke="#A88F52" 
                  strokeWidth={3}
                  name="Custos Variáveis"
                />
                <Line 
                  type="monotone" 
                  dataKey="total" 
                  stroke="#1A1A1A" 
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribuição Fixos vs Variáveis - Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Proporção: Fixos vs Variáveis (Dez 2026)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={fixosVsVariaveisPie}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {fixosVsVariaveisPie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Ponto de Equilíbrio */}
      <Card className="bg-gradient-to-r from-[#546A4A] to-[#3B2F28] text-white">
        <CardHeader>
          <CardTitle className="text-white">📊 Análise de Ponto de Equilíbrio (Break-Even)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm opacity-90 mb-2">Ponto de Equilíbrio (kg)</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {pontoEquilibrioKg.toFixed(0)} kg
            </div>
            <p className="text-xs opacity-70 mt-1">Produção mínima necessária</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Ponto de Equilíbrio (R$)</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              R$ {pontoEquilibrioReais.toFixed(0)}
            </div>
            <p className="text-xs opacity-70 mt-1">Receita mínima necessária</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Produção Atual</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {producaoKg} kg
            </div>
            <p className="text-xs opacity-70 mt-1">
              {((producaoKg / pontoEquilibrioKg) * 100 - 100).toFixed(1)}% acima do break-even
            </p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Margem de Segurança</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {((1 - pontoEquilibrioReais / receitaAtual) * 100).toFixed(1)}%
            </div>
            <p className="text-xs opacity-70 mt-1">Folga sobre o break-even</p>
          </div>
        </CardContent>
      </Card>

      {/* Tabelas Detalhadas - Custos Fixos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-[#3B2F28]" />
            Detalhamento de Custos Fixos (Mensais)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-[#3B2F28]">
                <tr>
                  <th className="text-left py-3 px-2 font-semibold text-sm">Item</th>
                  <th className="text-left py-3 px-2 font-semibold text-sm">Categoria</th>
                  <th className="text-right py-3 px-2 font-semibold text-sm">Valor Mensal</th>
                  <th className="text-right py-3 px-2 font-semibold text-sm">% do Total Fixo</th>
                </tr>
              </thead>
              <tbody>
                {custosFixos.map((custo, idx) => (
                  <tr key={idx} className="border-b border-[#E3E3E3] hover:bg-[#F5F5F5]">
                    <td className="py-3 px-2 text-sm">{custo.item}</td>
                    <td className="py-3 px-2 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs bg-[#3B2F28] text-white">
                        {custo.categoria}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm text-right font-semibold">
                      R$ {custo.valor.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-2 text-sm text-right">
                      {((custo.valor / totalCustosFixos) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#3B2F28] bg-[#3B2F28] text-white">
                <tr>
                  <td colSpan={2} className="py-3 px-2 font-semibold">
                    Total de Custos Fixos
                  </td>
                  <td className="py-3 px-2 text-right font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 700 }}>
                    R$ {totalCustosFixos.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Tabela Detalhada - Custos Variáveis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#A88F52]" />
            Detalhamento de Custos Variáveis (Dezembro 2026)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b-2 border-[#A88F52]">
                <tr>
                  <th className="text-left py-3 px-2 font-semibold text-sm">Item</th>
                  <th className="text-left py-3 px-2 font-semibold text-sm">Categoria</th>
                  <th className="text-center py-3 px-2 font-semibold text-sm">Unidade</th>
                  <th className="text-right py-3 px-2 font-semibold text-sm">Valor Total</th>
                  <th className="text-right py-3 px-2 font-semibold text-sm">% do Total Variável</th>
                </tr>
              </thead>
              <tbody>
                {custosVariaveis.map((custo, idx) => (
                  <tr key={idx} className="border-b border-[#E3E3E3] hover:bg-[#F5F5F5]">
                    <td className="py-3 px-2 text-sm">{custo.item}</td>
                    <td className="py-3 px-2 text-sm">
                      <span className="px-2 py-1 rounded-full text-xs bg-[#A88F52] text-white">
                        {custo.categoria}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-xs text-center text-[#1A1A1A] opacity-70">
                      {custo.unidade}
                    </td>
                    <td className="py-3 px-2 text-sm text-right font-semibold">
                      R$ {custo.valor.toLocaleString('pt-BR')}
                    </td>
                    <td className="py-3 px-2 text-sm text-right">
                      {((custo.valor / totalCustosVariaveis) * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-[#A88F52] bg-[#A88F52] text-white">
                <tr>
                  <td colSpan={3} className="py-3 px-2 font-semibold">
                    Total de Custos Variáveis
                  </td>
                  <td className="py-3 px-2 text-right font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 700 }}>
                    R$ {totalCustosVariaveis.toLocaleString('pt-BR')}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
          
          <div className="mt-4 p-4 bg-[#FFF9E6] border-l-4 border-[#A88F52] rounded">
            <p className="text-sm font-semibold text-[#1A1A1A]">💡 Custo Variável Unitário</p>
            <p className="text-xs text-[#1A1A1A] opacity-70 mt-1">
              Custo por kg produzido: <span className="font-bold text-[#A88F52]">R$ {custoVariavelKg.toFixed(2)}/kg</span>
              {' '}(baseado em {producaoKg} kg produzidos em Dez/2026)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Charts originais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução de Receita (6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#546A4A" 
                  strokeWidth={3}
                  name="Receita"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Custos (mês atual)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expenseBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {expenseBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Cost by Lote */}
      <Card>
        <CardHeader>
          <CardTitle>Rentabilidade por Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={costByLote}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E3E3E3" />
              <XAxis dataKey="lote" />
              <YAxis />
              <Tooltip formatter={(value: number) => `R$ ${value.toLocaleString('pt-BR')}`} />
              <Bar dataKey="cost" fill="#3B2F28" name="Custo" />
              <Bar dataKey="revenue" fill="#546A4A" name="Receita" />
              <Bar dataKey="profit" fill="#A88F52" name="Lucro" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Expense Details */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento de Custos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {expenseBreakdown.map((expense) => {
              const percentage = (expense.value / totalExpenses) * 100;
              return (
                <div key={expense.name}>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">{expense.name}</span>
                    <span className="text-sm">
                      R$ {expense.value.toLocaleString('pt-BR')} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#E3E3E3] rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: expense.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-6 border-t border-[#E3E3E3]">
            <div className="flex justify-between items-center">
              <span className="font-['Cormorant_Garamond']" style={{ fontSize: '20px', fontWeight: 600 }}>
                Total de Custos
              </span>
              <span className="font-['Cormorant_Garamond']" style={{ fontSize: '24px', fontWeight: 700 }}>
                R$ {totalExpenses.toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ROI Card */}
      <Card className="bg-[#546A4A] text-white">
        <CardHeader>
          <CardTitle>ROI das Salas de Cultivo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm opacity-90 mb-2">Sala A</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              142%
            </div>
            <p className="text-xs opacity-70 mt-1">12 lotes completados</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Sala B</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              128%
            </div>
            <p className="text-xs opacity-70 mt-1">10 lotes completados</p>
          </div>
          <div>
            <p className="text-sm opacity-90 mb-2">Sala C</p>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              135%
            </div>
            <p className="text-xs opacity-70 mt-1">11 lotes completados</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
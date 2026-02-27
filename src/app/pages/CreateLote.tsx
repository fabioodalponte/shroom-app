import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, QrCode, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { useCreateLote, useProdutos } from '../../hooks/useApi';

export function CreateLote() {
  const navigate = useNavigate();
  const { data: produtosData, loading: produtosLoading, fetch: fetchProdutos } = useProdutos();
  const { post: createLote, loading: creating } = useCreateLote();

  const [formData, setFormData] = useState({
    produto_id: '',
    data_inicio: new Date().toISOString().split('T')[0],
    data_previsao_colheita: '',
    quantidade_inicial: 0,
    unidade: 'kg',
    sala: '',
    prateleira: '',
    temperatura_atual: 0,
    umidade_atual: 0,
    observacoes: ''
  });

  useEffect(() => {
    fetchProdutos();
  }, [fetchProdutos]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await createLote(formData);
      navigate('/lotes');
    } catch (error) {
      console.error('Erro ao criar lote:', error);
    }
  };

  const handleProdutoChange = (produtoId: string) => {
    const produto = produtosData?.produtos?.find(p => p.id === produtoId);
    
    if (produto && produto.tempo_cultivo_dias) {
      // Calcular data prevista de colheita
      const dataInicio = new Date(formData.data_inicio);
      const dataPrevisao = new Date(dataInicio);
      dataPrevisao.setDate(dataPrevisao.getDate() + produto.tempo_cultivo_dias);
      
      setFormData({
        ...formData,
        produto_id: produtoId,
        data_previsao_colheita: dataPrevisao.toISOString().split('T')[0],
        temperatura_atual: produto.temperatura_ideal_min || 0,
        umidade_atual: produto.umidade_ideal_min || 0
      });
    } else {
      setFormData({ ...formData, produto_id: produtoId });
    }
  };

  const produtos = produtosData?.produtos || [];

  if (produtosLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate('/lotes')}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Criar Novo Lote
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Iniciar novo ciclo de produção
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Lote</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Produto */}
                <div>
                  <Label>Produto / Variedade *</Label>
                  <Select
                    value={formData.produto_id}
                    onValueChange={handleProdutoChange}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.length === 0 ? (
                        <div className="p-2 text-sm text-gray-500">
                          Nenhum produto cadastrado
                        </div>
                      ) : (
                        produtos.map(produto => (
                          <SelectItem key={produto.id} value={produto.id}>
                            {produto.nome}
                            {produto.variedade && ` - ${produto.variedade}`}
                            {produto.tempo_cultivo_dias && ` (${produto.tempo_cultivo_dias} dias)`}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Datas */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Data de Início *</Label>
                    <Input
                      type="date"
                      value={formData.data_inicio}
                      onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Previsão de Colheita</Label>
                    <Input
                      type="date"
                      value={formData.data_previsao_colheita}
                      onChange={(e) => setFormData({ ...formData, data_previsao_colheita: e.target.value })}
                    />
                  </div>
                </div>

                {/* Quantidade */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Quantidade Inicial</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={formData.quantidade_inicial || ''}
                      onChange={(e) => setFormData({ ...formData, quantidade_inicial: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <Label>Unidade</Label>
                    <Select
                      value={formData.unidade}
                      onValueChange={(value) => setFormData({ ...formData, unidade: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="kg">Quilogramas (kg)</SelectItem>
                        <SelectItem value="unidades">Unidades</SelectItem>
                        <SelectItem value="blocos">Blocos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Localização */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Sala *</Label>
                    <Input
                      placeholder="Ex: Sala A, Sala Cultivo 1"
                      value={formData.sala}
                      onChange={(e) => setFormData({ ...formData, sala: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Prateleira</Label>
                    <Input
                      placeholder="Ex: Prateleira 3"
                      value={formData.prateleira}
                      onChange={(e) => setFormData({ ...formData, prateleira: e.target.value })}
                    />
                  </div>
                </div>

                {/* Condições Iniciais */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label>Temperatura Inicial (°C)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="20.0"
                      value={formData.temperatura_atual || ''}
                      onChange={(e) => setFormData({ ...formData, temperatura_atual: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div>
                    <Label>Umidade Inicial (%)</Label>
                    <Input
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      placeholder="85"
                      value={formData.umidade_atual || ''}
                      onChange={(e) => setFormData({ ...formData, umidade_atual: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                {/* Observações */}
                <div>
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Informações adicionais sobre o lote..."
                    rows={3}
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  />
                </div>

                {/* Buttons */}
                <div className="flex gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate('/lotes')}
                    className="flex-1"
                    disabled={creating}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    disabled={creating || produtos.length === 0}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      'Criar Lote'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Info Side Panel */}
        <div className="space-y-6">
          <Card className="bg-[#546A4A] text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5" />
                QR Code Automático
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm opacity-90">
                Ao criar o lote, um código único será gerado automaticamente para rastreabilidade completa.
              </p>
            </CardContent>
          </Card>

          {/* Parâmetros do Produto Selecionado */}
          {formData.produto_id && (
            <Card>
              <CardHeader>
                <CardTitle>Parâmetros Ideais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(() => {
                  const produto = produtos.find(p => p.id === formData.produto_id);
                  if (!produto) return null;
                  
                  return (
                    <div>
                      <h4 className="font-semibold mb-2">{produto.nome}</h4>
                      <ul className="text-sm space-y-1 text-gray-600">
                        {produto.temperatura_ideal_min && produto.temperatura_ideal_max && (
                          <li>• Temperatura: {produto.temperatura_ideal_min}°C - {produto.temperatura_ideal_max}°C</li>
                        )}
                        {produto.umidade_ideal_min && produto.umidade_ideal_max && (
                          <li>• Umidade: {produto.umidade_ideal_min}% - {produto.umidade_ideal_max}%</li>
                        )}
                        {produto.tempo_cultivo_dias && (
                          <li>• Ciclo: ~{produto.tempo_cultivo_dias} dias</li>
                        )}
                        {produto.peso_medio_g && (
                          <li>• Peso médio: {produto.peso_medio_g}g</li>
                        )}
                      </ul>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* Produtos Disponíveis */}
          {!formData.produto_id && produtos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Produtos Disponíveis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {produtos.slice(0, 5).map(produto => (
                  <div key={produto.id} className="border-l-4 border-emerald-500 pl-3">
                    <h4 className="font-semibold">{produto.nome}</h4>
                    <p className="text-sm text-gray-600">
                      {produto.tempo_cultivo_dias && `${produto.tempo_cultivo_dias} dias`}
                      {produto.preco_kg && ` • R$ ${produto.preco_kg}/kg`}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

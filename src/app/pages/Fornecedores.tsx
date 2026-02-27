import { useEffect, useState } from 'react';
import { Plus, Search, Loader2, ArrowLeft, Building2, Phone, Mail } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { toast } from 'sonner@2.0.3';
import { fetchServer } from '../../utils/supabase/client';
import { useNavigate } from 'react-router';

interface Fornecedor {
  id: string;
  nome: string;
  cnpj?: string;
  tipo_fornecedor: string;
  contato?: string;
  email?: string;
  endereco?: string;
  observacoes?: string;
  created_at: string;
}

export function Fornecedores() {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    cnpj: '',
    tipo_fornecedor: 'Matéria-Prima',
    contato: '',
    email: '',
    endereco: '',
    observacoes: ''
  });

  const tiposFornecedor = [
    'Matéria-Prima',
    'Embalagens',
    'Utilidades',
    'Serviços',
    'Manutenção',
    'Tecnologia',
    'Contabilidade/Legal',
    'Transporte',
    'Marketing',
    'Outros'
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const result = await fetchServer('/fornecedores');
      console.log('🏢 Fornecedores carregados:', result);
      setFornecedores(result.fornecedores || []);
    } catch (error) {
      console.error('Erro ao carregar fornecedores:', error);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFornecedor = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.nome || formData.nome.trim() === '') {
        toast.error('Por favor, insira o nome do fornecedor');
        return;
      }

      const dataToSend = {
        nome: formData.nome.trim(),
        cnpj: formData.cnpj.trim() || null,
        tipo_fornecedor: formData.tipo_fornecedor,
        contato: formData.contato.trim() || null,
        email: formData.email.trim() || null,
        endereco: formData.endereco.trim() || null,
        observacoes: formData.observacoes.trim() || null
      };

      console.log('📤 Enviando dados do fornecedor:', JSON.stringify(dataToSend, null, 2));

      setCreating(true);
      const result = await fetchServer('/fornecedores', {
        method: 'POST',
        body: JSON.stringify(dataToSend)
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success('Fornecedor cadastrado com sucesso!');
      setIsDialogOpen(false);
      fetchData();
      
      // Reset form
      setFormData({
        nome: '',
        cnpj: '',
        tipo_fornecedor: 'Matéria-Prima',
        contato: '',
        email: '',
        endereco: '',
        observacoes: ''
      });
    } catch (error: any) {
      console.error('Erro ao criar fornecedor:', error);
      toast.error(error.message || 'Erro ao cadastrar fornecedor');
    } finally {
      setCreating(false);
    }
  };

  const getTipoColor = (tipo: string) => {
    const colors: Record<string, string> = {
      'Matéria-Prima': 'bg-green-100 text-green-700',
      'Embalagens': 'bg-blue-100 text-blue-700',
      'Utilidades': 'bg-yellow-100 text-yellow-700',
      'Serviços': 'bg-purple-100 text-purple-700',
      'Manutenção': 'bg-orange-100 text-orange-700',
      'Tecnologia': 'bg-indigo-100 text-indigo-700',
      'Contabilidade/Legal': 'bg-gray-100 text-gray-700',
      'Transporte': 'bg-cyan-100 text-cyan-700',
      'Marketing': 'bg-pink-100 text-pink-700'
    };
    return colors[tipo] || 'bg-gray-100 text-gray-700';
  };

  const filteredFornecedores = fornecedores.filter(f => 
    f.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cnpj?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.tipo_fornecedor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-[#546A4A]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Button 
            variant="ghost" 
            onClick={() => navigate('/compras')}
            className="mb-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Compras
          </Button>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Fornecedores
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Cadastro e gestão de fornecedores
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#546A4A] hover:bg-[#3B5039]">
              <Plus className="w-4 h-4 mr-2" />
              Novo Fornecedor
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Fornecedor</DialogTitle>
              <DialogDescription>Insira os dados do fornecedor.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateFornecedor} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Fornecedor *</Label>
                  <Input
                    placeholder="Ex: Substrato Brasil Ltda"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>CNPJ</Label>
                  <Input
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Tipo de Fornecedor *</Label>
                <Select
                  value={formData.tipo_fornecedor}
                  onValueChange={(value) => setFormData({ ...formData, tipo_fornecedor: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposFornecedor.map(tipo => (
                      <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Telefone/WhatsApp</Label>
                  <Input
                    placeholder="(00) 00000-0000"
                    value={formData.contato}
                    onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
                  />
                </div>

                <div>
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    placeholder="contato@fornecedor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>Endereço</Label>
                <Input
                  placeholder="Rua, número, bairro, cidade - UF"
                  value={formData.endereco}
                  onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                />
              </div>

              <div>
                <Label>Observações</Label>
                <Input
                  placeholder="Notas adicionais sobre o fornecedor..."
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                />
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={creating} className="flex-1 bg-[#546A4A] hover:bg-[#3B5039]">
                  {creating ? 'Cadastrando...' : 'Cadastrar Fornecedor'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Total de Fornecedores</p>
            <p className="text-3xl font-bold text-[#546A4A] mt-2">{fornecedores.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Matéria-Prima</p>
            <p className="text-3xl font-bold text-green-600 mt-2">
              {fornecedores.filter(f => f.tipo_fornecedor === 'Matéria-Prima').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Embalagens</p>
            <p className="text-3xl font-bold text-blue-600 mt-2">
              {fornecedores.filter(f => f.tipo_fornecedor === 'Embalagens').length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-gray-600">Serviços</p>
            <p className="text-3xl font-bold text-purple-600 mt-2">
              {fornecedores.filter(f => f.tipo_fornecedor === 'Serviços').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Buscar fornecedores por nome, CNPJ, tipo ou e-mail..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Fornecedores List */}
      <Card>
        <CardHeader>
          <CardTitle>Fornecedores Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredFornecedores.length === 0 ? (
            <p className="text-gray-500 text-center py-8">
              {searchTerm ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado. Cadastre o primeiro fornecedor!'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFornecedores.map((fornecedor) => (
                <div
                  key={fornecedor.id}
                  className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-[#546A4A]" />
                      <h4 className="font-semibold text-lg">{fornecedor.nome}</h4>
                    </div>
                    <Badge className={getTipoColor(fornecedor.tipo_fornecedor)}>
                      {fornecedor.tipo_fornecedor}
                    </Badge>
                  </div>

                  {fornecedor.cnpj && (
                    <p className="text-sm text-gray-600 mb-2">
                      <strong>CNPJ:</strong> {fornecedor.cnpj}
                    </p>
                  )}

                  {fornecedor.contato && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Phone className="w-4 h-4" />
                      {fornecedor.contato}
                    </div>
                  )}

                  {fornecedor.email && (
                    <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                      <Mail className="w-4 h-4" />
                      {fornecedor.email}
                    </div>
                  )}

                  {fornecedor.endereco && (
                    <p className="text-xs text-gray-500 mt-2">
                      📍 {fornecedor.endereco}
                    </p>
                  )}

                  {fornecedor.observacoes && (
                    <p className="text-xs text-gray-500 mt-2 italic border-t pt-2">
                      {fornecedor.observacoes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

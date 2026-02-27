import { useEffect, useState } from 'react';
import { Plus, Search, Building2, User, Mail, Phone, MapPin, FileText, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Textarea } from '../../components/ui/textarea';
import { useClientes, useCreateCliente } from '../../hooks/useApi';
import { useAuth } from '../../contexts/AuthContext';

export function Clientes() {
  const { usuario } = useAuth();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTab, setSelectedTab] = useState('todos');
  const [formData, setFormData] = useState({
    nome: '',
    tipo_cliente: 'B2B',
    email: '',
    telefone: '',
    cpf_cnpj: '',
    endereco: '',
    cidade: '',
    estado: '',
    cep: '',
    observacoes: '',
    ativo: true
  });

  const { data: clientesData, loading: clientesLoading, fetch: fetchClientes } = useClientes();
  const { post: createCliente, loading: creating } = useCreateCliente();

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  const handleCreateCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Filtrar campos vazios e adicionar usuario_id
      const dataToSend: any = {
        nome: formData.nome,
        tipo_cliente: formData.tipo_cliente,
        email: formData.email,
        telefone: formData.telefone,
        ativo: formData.ativo,
      };

      // Adicionar campos opcionais apenas se não estiverem vazios
      if (formData.cpf_cnpj) dataToSend.cpf_cnpj = formData.cpf_cnpj;
      if (formData.endereco) dataToSend.endereco = formData.endereco;
      if (formData.cidade) dataToSend.cidade = formData.cidade;
      if (formData.estado) dataToSend.estado = formData.estado;
      if (formData.cep) dataToSend.cep = formData.cep;
      if (formData.observacoes) dataToSend.observacoes = formData.observacoes;
      
      // Adicionar usuario_id do usuário logado
      if (usuario?.id) {
        dataToSend.usuario_id = usuario.id;
      }

      console.log('📤 Enviando dados do cliente:', JSON.stringify(dataToSend, null, 2));
      await createCliente(dataToSend);
      setIsDialogOpen(false);
      fetchClientes();
      
      // Reset form
      setFormData({
        nome: '',
        tipo_cliente: 'B2B',
        email: '',
        telefone: '',
        cpf_cnpj: '',
        endereco: '',
        cidade: '',
        estado: '',
        cep: '',
        observacoes: '',
        ativo: true
      });
    } catch (error) {
      console.error(error);
    }
  };

  const clientes = clientesData?.clientes || [];

  const filteredClientes = clientes.filter(cliente => {
    const matchesSearch = cliente.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         cliente.telefone?.includes(searchTerm);
    
    const matchesTab = selectedTab === 'todos' || cliente.tipo_cliente === selectedTab;
    
    return matchesSearch && matchesTab;
  });

  const clientesB2B = clientes.filter(c => c.tipo_cliente === 'B2B');
  const clientesB2C = clientes.filter(c => c.tipo_cliente === 'B2C');

  return (
    <div className="min-h-screen bg-[#F5F1E8] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[#2C1810] flex items-center gap-2">
              <Building2 className="w-8 h-8 text-[#A88F52]" />
              Gestão de Clientes
            </h1>
            <p className="text-[#8B7355] mt-1">
              Cadastre e gerencie seus clientes B2B e B2C
            </p>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#A88F52] hover:bg-[#8B7355] text-white">
                <Plus className="w-4 h-4 mr-2" />
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" aria-describedby="dialog-description">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-[#A88F52]" />
                  Cadastrar Novo Cliente
                </DialogTitle>
                <DialogDescription id="dialog-description">
                  Preencha os dados do cliente para adicionar ao sistema
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateCliente} className="space-y-4">
                {/* Tipo de Cliente */}
                <div className="space-y-2">
                  <Label>Tipo de Cliente *</Label>
                  <Select
                    value={formData.tipo_cliente}
                    onValueChange={(value) => setFormData({ ...formData, tipo_cliente: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B2B">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          B2B - Restaurantes e Empresas
                        </div>
                      </SelectItem>
                      <SelectItem value="B2C">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4" />
                          B2C - Consumidor Final
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Nome */}
                <div className="space-y-2">
                  <Label>Nome {formData.tipo_cliente === 'B2B' ? 'da Empresa' : 'do Cliente'} *</Label>
                  <Input
                    placeholder={formData.tipo_cliente === 'B2B' ? 'Ex: Restaurante Sabor & Arte' : 'Ex: João Silva'}
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                    required
                  />
                </div>

                {/* Documento */}
                <div className="space-y-2">
                  <Label>{formData.tipo_cliente === 'B2B' ? 'CNPJ' : 'CPF'}</Label>
                  <Input
                    placeholder={formData.tipo_cliente === 'B2B' ? '00.000.000/0000-00' : '000.000.000-00'}
                    value={formData.cpf_cnpj}
                    onChange={(e) => setFormData({ ...formData, cpf_cnpj: e.target.value })}
                  />
                </div>

                {/* Email e Telefone */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Email *</Label>
                    <Input
                      type="email"
                      placeholder="email@exemplo.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone *</Label>
                    <Input
                      placeholder="(11) 99999-9999"
                      value={formData.telefone}
                      onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                {/* Endereço */}
                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    placeholder="Rua, número, complemento"
                    value={formData.endereco}
                    onChange={(e) => setFormData({ ...formData, endereco: e.target.value })}
                  />
                </div>

                {/* Cidade, Estado e CEP */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label>Cidade</Label>
                    <Input
                      placeholder="São Paulo"
                      value={formData.cidade}
                      onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input
                      placeholder="SP"
                      maxLength={2}
                      value={formData.estado}
                      onChange={(e) => setFormData({ ...formData, estado: e.target.value.toUpperCase() })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>CEP</Label>
                  <Input
                    placeholder="00000-000"
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                  />
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    placeholder="Informações adicionais sobre o cliente..."
                    value={formData.observacoes}
                    onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    className="flex-1"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={creating}
                    className="flex-1 bg-[#A88F52] hover:bg-[#8B7355] text-white"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cadastrando...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Cadastrar Cliente
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-[#E5D5B7] bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#8B7355]">Total de Clientes</p>
                  <p className="text-3xl text-[#2C1810] mt-1">{clientes.length}</p>
                </div>
                <Building2 className="w-10 h-10 text-[#A88F52] opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5D5B7] bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#8B7355]">Clientes B2B</p>
                  <p className="text-3xl text-[#2C1810] mt-1">{clientesB2B.length}</p>
                </div>
                <Building2 className="w-10 h-10 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-[#E5D5B7] bg-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-[#8B7355]">Clientes B2C</p>
                  <p className="text-3xl text-[#2C1810] mt-1">{clientesB2C.length}</p>
                </div>
                <User className="w-10 h-10 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="border-[#E5D5B7] bg-white">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#8B7355] w-4 h-4" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-[#E5D5B7]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="bg-[#E5D5B7]">
            <TabsTrigger value="todos">Todos ({clientes.length})</TabsTrigger>
            <TabsTrigger value="B2B">B2B ({clientesB2B.length})</TabsTrigger>
            <TabsTrigger value="B2C">B2C ({clientesB2C.length})</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-6">
            {clientesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#A88F52]" />
              </div>
            ) : filteredClientes.length === 0 ? (
              <Card className="border-[#E5D5B7] bg-white">
                <CardContent className="p-12 text-center">
                  <Building2 className="w-16 h-16 text-[#E5D5B7] mx-auto mb-4" />
                  <h3 className="text-[#2C1810] mb-2">Nenhum cliente encontrado</h3>
                  <p className="text-[#8B7355]">
                    {searchTerm ? 'Tente alterar os filtros de busca' : 'Cadastre seu primeiro cliente para começar'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClientes.map((cliente) => (
                  <Card key={cliente.id} className="border-[#E5D5B7] bg-white hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          {cliente.tipo_cliente === 'B2B' ? (
                            <Building2 className="w-5 h-5 text-blue-500" />
                          ) : (
                            <User className="w-5 h-5 text-green-500" />
                          )}
                          <CardTitle className="text-lg text-[#2C1810]">
                            {cliente.nome}
                          </CardTitle>
                        </div>
                        <Badge className={cliente.tipo_cliente === 'B2B' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                          {cliente.tipo_cliente}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {cliente.email && (
                        <div className="flex items-center gap-2 text-sm text-[#8B7355]">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{cliente.email}</span>
                        </div>
                      )}
                      {cliente.telefone && (
                        <div className="flex items-center gap-2 text-sm text-[#8B7355]">
                          <Phone className="w-4 h-4" />
                          <span>{cliente.telefone}</span>
                        </div>
                      )}
                      {cliente.cidade && (
                        <div className="flex items-center gap-2 text-sm text-[#8B7355]">
                          <MapPin className="w-4 h-4" />
                          <span>{cliente.cidade}{cliente.estado ? `, ${cliente.estado}` : ''}</span>
                        </div>
                      )}
                      {cliente.cpf_cnpj && (
                        <div className="flex items-center gap-2 text-sm text-[#8B7355]">
                          <FileText className="w-4 h-4" />
                          <span>{cliente.cpf_cnpj}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

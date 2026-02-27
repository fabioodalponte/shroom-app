import { useEffect, useState } from 'react';
import { Truck, Plus, Edit, Trash2, Phone, Mail, IdCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../components/ui/dialog';
import { Label } from '../../components/ui/label';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner@2.0.3';
import { fetchServer } from '../../utils/supabase/client';

export function Motoristas() {
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMotorista, setEditingMotorista] = useState<any>(null);

  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    telefone: '',
    cpf: '',
    cnh: '',
  });

  useEffect(() => {
    fetchMotoristas();
  }, []);

  const fetchMotoristas = async () => {
    try {
      setLoading(true);
      const result = await fetchServer('/motoristas');
      setMotoristas(result.motoristas || []);
    } catch (error) {
      console.error('Erro ao buscar motoristas:', error);
      toast.error('Erro ao carregar motoristas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.email) {
      toast.error('Nome e email são obrigatórios');
      return;
    }

    try {
      await fetchServer('/motoristas', {
        method: 'POST',
        body: JSON.stringify(formData),
      });

      toast.success('Motorista cadastrado com sucesso!');
      setIsCreateOpen(false);
      setFormData({ nome: '', email: '', telefone: '', cpf: '', cnh: '' });
      fetchMotoristas();
    } catch (error: any) {
      console.error('Erro ao criar motorista:', error);
      
      // Mensagem específica para email duplicado
      if (error.message?.includes('duplicate key') || error.message?.includes('already exists')) {
        toast.error(`Email ${formData.email} já está cadastrado! Use outro email.`);
      } else {
        toast.error(error.message || 'Erro ao cadastrar motorista');
      }
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingMotorista) return;

    try {
      await fetchServer(`/motoristas/${editingMotorista.id}`, {
        method: 'PUT',
        body: JSON.stringify(formData),
      });

      toast.success('Motorista atualizado com sucesso!');
      setIsEditOpen(false);
      setEditingMotorista(null);
      setFormData({ nome: '', email: '', telefone: '', cpf: '', cnh: '' });
      fetchMotoristas();
    } catch (error: any) {
      console.error('Erro ao atualizar motorista:', error);
      toast.error(error.message || 'Erro ao atualizar motorista');
    }
  };

  const handleEdit = (motorista: any) => {
    setEditingMotorista(motorista);
    setFormData({
      nome: motorista.nome || '',
      email: motorista.email || '',
      telefone: motorista.telefone || '',
      cpf: motorista.cpf || '',
      cnh: motorista.cnh || '',
    });
    setIsEditOpen(true);
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!confirm(`Tem certeza que deseja remover o motorista ${nome}?`)) {
      return;
    }

    try {
      await fetchServer(`/motoristas/${id}`, {
        method: 'DELETE',
      });

      toast.success('Motorista removido com sucesso!');
      fetchMotoristas();
    } catch (error: any) {
      console.error('Erro ao remover motorista:', error);
      toast.error(error.message || 'Erro ao remover motorista');
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-['Cormorant_Garamond']" style={{ fontSize: '42px', fontWeight: 700 }}>
            Motoristas
          </h1>
          <p className="text-[#1A1A1A] opacity-70 mt-1">
            Gestão da equipe de entrega
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button 
              className="bg-[#546A4A] hover:bg-[#3B2F28]"
              onClick={() => {
                console.log('🔵 Botão clicado! Abrindo modal...');
                setIsCreateOpen(true);
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              Novo Motorista
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Novo Motorista</DialogTitle>
              <DialogDescription>Preencha os dados do motorista</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label>Nome Completo *</Label>
                <Input
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Ex: João Silva"
                  required
                />
              </div>
              <div>
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="joao@exemplo.com"
                  required
                />
              </div>
              <div>
                <Label>Telefone</Label>
                <Input
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div>
                <Label>CPF</Label>
                <Input
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>CNH</Label>
                <Input
                  value={formData.cnh}
                  onChange={(e) => setFormData({ ...formData, cnh: e.target.value })}
                  placeholder="Número da CNH"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setFormData({ nome: '', email: '', telefone: '', cpf: '', cnh: '' });
                  }}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1 bg-[#546A4A] hover:bg-[#3B2F28]">
                  Cadastrar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Dialog de Edição */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Motorista</DialogTitle>
            <DialogDescription>Atualize os dados do motorista</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <Label>Nome Completo *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: João Silva"
                required
              />
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="joao@exemplo.com"
                required
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                value={formData.cpf}
                onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                placeholder="000.000.000-00"
              />
            </div>
            <div>
              <Label>CNH</Label>
              <Input
                value={formData.cnh}
                onChange={(e) => setFormData({ ...formData, cnh: e.target.value })}
                placeholder="Número da CNH"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  setEditingMotorista(null);
                  setFormData({ nome: '', email: '', telefone: '', cpf: '', cnh: '' });
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-[#546A4A] hover:bg-[#3B2F28]">
                Salvar Alterações
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm opacity-70">Total de Motoristas</CardTitle>
            <Truck className="w-4 h-4 text-[#546A4A]" />
          </CardHeader>
          <CardContent>
            <div className="font-['Cormorant_Garamond']" style={{ fontSize: '32px', fontWeight: 700 }}>
              {motoristas.length}
            </div>
            <p className="text-xs text-[#1A1A1A] opacity-70 mt-1">
              Ativos no sistema
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Motoristas */}
      <div>
        <h2 className="font-['Cormorant_Garamond']" style={{ fontSize: '28px', fontWeight: 600 }} className="mb-4">
          Equipe de Motoristas
        </h2>

        {loading ? (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-500">Carregando...</p>
            </CardContent>
          </Card>
        ) : motoristas.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Truck className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">Nenhum motorista cadastrado</p>
              <p className="text-sm text-gray-400 mt-1">
                Clique em "Novo Motorista" para começar
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {motoristas.map((motorista) => (
              <Card key={motorista.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-[#546A4A] flex items-center justify-center">
                        <Truck className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{motorista.nome}</CardTitle>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    {motorista.email && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Mail size={14} />
                        <span className="truncate">{motorista.email}</span>
                      </div>
                    )}
                    {motorista.telefone && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Phone size={14} />
                        <span>{motorista.telefone}</span>
                      </div>
                    )}
                    {motorista.cnh && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <IdCard size={14} />
                        <span>CNH: {motorista.cnh}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => handleEdit(motorista)}
                    >
                      <Edit className="w-4 h-4 mr-1" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-500 text-red-500 hover:bg-red-50"
                      onClick={() => handleDelete(motorista.id, motorista.nome)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
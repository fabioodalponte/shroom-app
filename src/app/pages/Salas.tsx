import { useEffect, useMemo, useState } from 'react';
import { Building2, Loader2, Pencil, Plus, Power, RefreshCcw } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { fetchServer } from '../../utils/supabase/client';
import { useCreateSala, useSalas, useUpdateSala } from '../../hooks/useApi';
import { toast } from 'sonner@2.0.3';

interface SalaItem {
  id: string;
  codigo: string;
  nome: string;
  tipo?: string | null;
  ativa?: boolean | null;
  descricao?: string | null;
}

const DEFAULT_FORM = {
  codigo: '',
  nome: '',
  tipo: 'cultivo',
  ativa: true,
  descricao: '',
};

export function Salas() {
  const { data, loading, error, fetch } = useSalas();
  const { post: createSala, loading: creating } = useCreateSala();
  const [editingSalaId, setEditingSalaId] = useState<string | null>(null);
  const { put: updateSala, loading: updating } = useUpdateSala(editingSalaId || '');
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => {
    void fetch();
  }, [fetch]);

  const salas = useMemo(() => (data?.salas || []) as SalaItem[], [data?.salas]);
  const isEditing = Boolean(editingSalaId);

  const resetForm = () => {
    setEditingSalaId(null);
    setFormData(DEFAULT_FORM);
  };

  const loadSalaIntoForm = (sala: SalaItem) => {
    setEditingSalaId(sala.id);
    setFormData({
      codigo: sala.codigo || '',
      nome: sala.nome || '',
      tipo: sala.tipo || 'cultivo',
      ativa: sala.ativa !== false,
      descricao: sala.descricao || '',
    });
  };

  const refreshSalas = async () => {
    await fetch();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      codigo: formData.codigo,
      nome: formData.nome,
      tipo: formData.tipo,
      ativa: formData.ativa,
      descricao: formData.descricao,
    };

    try {
      if (isEditing && editingSalaId) {
        await updateSala(payload);
      } else {
        await createSala(payload);
      }

      resetForm();
      await refreshSalas();
    } catch (submitError) {
      console.error('Erro ao salvar sala:', submitError);
    }
  };

  const handleToggleStatus = async (sala: SalaItem) => {
    try {
      await fetchServer(`/salas/${sala.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ativa: !(sala.ativa !== false),
        }),
      });

      toast.success(`Sala ${sala.ativa !== false ? 'desativada' : 'ativada'} com sucesso!`);
      await refreshSalas();
    } catch (toggleError: any) {
      console.error('Erro ao atualizar status da sala:', toggleError);
      toast.error(toggleError?.message || 'Erro ao atualizar status da sala.');
    }
  };

  if (loading && salas.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-['Cormorant_Garamond'] text-[42px] font-bold leading-none text-[#1A1A1A]">
            Salas
          </h1>
          <p className="mt-1 text-[#1A1A1A]/70">
            Base simples para organizar ambiente, sensores, câmeras e lotes por sala.
          </p>
        </div>

        <Button variant="outline" onClick={() => void refreshSalas()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-red-700">
            Não foi possível carregar as salas. {error.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px,1fr]">
        <Card className="h-fit">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>{isEditing ? 'Editar sala' : 'Nova sala'}</CardTitle>
            {isEditing ? (
              <Button variant="ghost" size="sm" onClick={resetForm}>
                Nova sala
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  placeholder="Ex: SALA_1"
                  value={formData.codigo}
                  onChange={(event) => setFormData((current) => ({ ...current, codigo: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Sala 1"
                  value={formData.nome}
                  onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo</Label>
                <Select
                  value={formData.tipo}
                  onValueChange={(value) => setFormData((current) => ({ ...current, tipo: value }))}
                >
                  <SelectTrigger id="tipo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cultivo">Cultivo</SelectItem>
                    <SelectItem value="frutificacao">Frutificação</SelectItem>
                    <SelectItem value="incubacao">Incubação</SelectItem>
                    <SelectItem value="apoio">Apoio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="descricao">Descrição</Label>
                <Textarea
                  id="descricao"
                  rows={3}
                  placeholder="Observações operacionais da sala..."
                  value={formData.descricao}
                  onChange={(event) => setFormData((current) => ({ ...current, descricao: event.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-[#E8E1D5] bg-[#FBF8F3] px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-[#1A1A1A]">Sala ativa</p>
                  <p className="text-xs text-[#1A1A1A]/60">Salas inativas ficam disponíveis para histórico, mas saem do fluxo operacional.</p>
                </div>
                <Switch
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData((current) => ({ ...current, ativa: checked }))}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#546A4A] hover:bg-[#546A4A]/90"
                disabled={creating || updating}
              >
                {creating || updating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    {isEditing ? <Pencil className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
                    {isEditing ? 'Salvar ajustes' : 'Cadastrar sala'}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Salas cadastradas</CardTitle>
            <Badge variant="outline">{salas.length} salas</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {salas.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#D8D0C1] bg-[#FBF8F3] p-6 text-center text-sm text-[#1A1A1A]/65">
                Nenhuma sala cadastrada ainda. Cadastre a primeira para vincular lotes e sensores ao ambiente correto.
              </div>
            ) : (
              salas.map((sala) => (
                <div
                  key={sala.id}
                  className="flex flex-col gap-4 rounded-2xl border border-[#E8E1D5] bg-white p-4 md:flex-row md:items-start md:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="rounded-full bg-[#546A4A]/10 p-2 text-[#546A4A]">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium text-[#1A1A1A]">{sala.nome}</p>
                          <p className="text-sm text-[#1A1A1A]/60">{sala.codigo}</p>
                        </div>
                      </div>
                      <Badge variant={sala.ativa !== false ? 'default' : 'outline'} className={sala.ativa !== false ? 'bg-[#546A4A] hover:bg-[#546A4A]' : ''}>
                        {sala.ativa !== false ? 'Ativa' : 'Inativa'}
                      </Badge>
                      <Badge variant="outline">{sala.tipo || 'cultivo'}</Badge>
                    </div>

                    <p className="text-sm text-[#1A1A1A]/70">
                      {sala.descricao || 'Sem descrição adicional.'}
                    </p>
                    <p className="text-xs text-[#1A1A1A]/50">ID operacional: {sala.id}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => loadSalaIntoForm(sala)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleToggleStatus(sala)}>
                      <Power className="mr-2 h-4 w-4" />
                      {sala.ativa !== false ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

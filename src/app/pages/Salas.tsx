import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Cpu,
  Droplets,
  Loader2,
  Pencil,
  Plus,
  Power,
  Radio,
  RefreshCcw,
  Search,
  Thermometer,
  Wind,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Switch } from '../../components/ui/switch';
import { Textarea } from '../../components/ui/textarea';
import { fetchServer } from '../../utils/supabase/client';
import { useCreateSala, useSalas, useUpdateSala } from '../../hooks/useApi';
import { toast } from 'sonner@2.0.3';
import {
  aggregateRooms,
  isRoomLinkDebugEnabled,
  type RoomController,
  type RoomLote,
  type RoomOperationalModel,
  type RoomSensorMonitor,
  type SalaRecord,
} from '../lib/room-operations';

const DEFAULT_FORM = {
  codigo: '',
  nome: '',
  tipo: 'cultivo',
  ativa: true,
  descricao: '',
};

function normalizeText(value?: string | null) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

function formatMetric(value: number | null, unit: string, fractionDigits = 1) {
  if (value === null || !Number.isFinite(value)) return '--';
  return `${value.toFixed(fractionDigits)}${unit}`;
}

function getRoomTypeLabel(tipo?: string | null) {
  const value = normalizeText(tipo);
  if (!value) return 'Sala';
  if (value === 'cultivo') return 'Cultivo';
  if (value === 'frutificacao') return 'Frutificação';
  if (value === 'incubacao') return 'Incubação';
  if (value === 'apoio') return 'Apoio';
  if (value === 'legado') return 'Legado';
  return tipo || 'Sala';
}

function getStatusCopy(room: RoomOperationalModel) {
  if (room.primaryAlert) return room.primaryAlert.title;
  const activeRule = room.rules.find((rule) => rule.active);
  if (activeRule) return activeRule.title;
  return 'Ambiente estável';
}

function getStatusContext(room: RoomOperationalModel) {
  if (room.primaryAlert) return room.primaryAlert.description;
  const activeRule = room.rules.find((rule) => rule.active);
  if (activeRule) return activeRule.description;
  return 'Automação baseada na média da sala e sensores coerentes.';
}

function getPhaseContext(room: RoomOperationalModel) {
  if (room.lotContext.primaryPhase) return room.lotContext.primaryPhase;
  if (room.lotesAtivos > 0) return 'Lotes ativos sem fase dominante';
  return 'Sem lote ativo na sala';
}

function getSummaryCards(rooms: RoomOperationalModel[]) {
  const totalSensores = rooms.reduce((sum, room) => sum + room.sensores.length, 0);
  const sensoresOnline = rooms.reduce((sum, room) => sum + room.sensoresOnline, 0);
  const lotesAtivos = rooms.reduce((sum, room) => sum + room.lotesAtivos, 0);

  return [
    {
      label: 'Salas monitoradas',
      value: rooms.length.toString().padStart(2, '0'),
      meta: 'unidades operacionais ativas no app',
      tone: 'ok',
    },
    {
      label: 'Salas críticas',
      value: rooms.filter((room) => room.status === 'critical').length.toString().padStart(2, '0'),
      meta: 'prioridade máxima de resposta',
      tone: 'critical',
    },
    {
      label: 'Sensores online',
      value: `${sensoresOnline}/${totalSensores || 0}`,
      meta: totalSensores > 0 ? 'telemetria conectada por sala' : 'sem telemetria vinculada',
      tone: 'warning',
    },
    {
      label: 'Lotes ativos',
      value: lotesAtivos.toString().padStart(2, '0'),
      meta: 'produção atualmente vinculada às salas',
      tone: 'ok',
    },
  ];
}

export function Salas() {
  const { data, loading: salasLoading, error: salasError, fetch: fetchSalas } = useSalas();
  const { post: createSala, loading: creating } = useCreateSala();
  const [editingSalaId, setEditingSalaId] = useState<string | null>(null);
  const { put: updateSala, loading: updating } = useUpdateSala(editingSalaId || '');
  const [formData, setFormData] = useState(DEFAULT_FORM);
  const [lotes, setLotes] = useState<RoomLote[]>([]);
  const [sensores, setSensores] = useState<RoomSensorMonitor[]>([]);
  const [atuadores, setAtuadores] = useState<RoomController[]>([]);
  const [loadingOperational, setLoadingOperational] = useState(false);
  const [operationalError, setOperationalError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'critical' | 'warning' | 'ok'>('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const formRef = useRef<HTMLDivElement | null>(null);

  const salas = useMemo(() => (data?.salas || []) as SalaRecord[], [data?.salas]);
  const rooms = useMemo(
    () => aggregateRooms({ salas, lotes, sensores, atuadores }),
    [atuadores, lotes, salas, sensores],
  );
  const roomIndex = useMemo(() => new Map(rooms.map((room) => [room.sala.id, room])), [rooms]);
  const summaryCards = useMemo(() => getSummaryCards(rooms), [rooms]);

  const roomTypeOptions = useMemo(() => {
    return Array.from(new Set(salas.map((sala) => sala.tipo).filter(Boolean)))
      .sort((a, b) => normalizeText(a).localeCompare(normalizeText(b)));
  }, [salas]);

  const filteredRooms = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    return rooms
      .filter((room) => {
        if (statusFilter !== 'todos' && room.status !== statusFilter) return false;
        if (typeFilter !== 'todos' && normalizeText(room.sala.tipo) !== normalizeText(typeFilter)) return false;

        if (!normalizedSearch) return true;

        const haystack = [
          room.sala.nome,
          room.sala.codigo,
          room.sala.tipo,
          room.sala.descricao,
          ...room.lotes.map((lote) => `${lote.codigo_lote} ${lote.produto?.nome || ''} ${lote.fase_operacional || ''}`),
          ...room.atuadores.map((atuador) => `${atuador.nome} ${atuador.localizacao || ''}`),
        ]
          .map(normalizeText)
          .join(' ');

        return haystack.includes(normalizedSearch);
      })
      .sort((a, b) => {
        const activeRank = Number(b.sala.ativa !== false) - Number(a.sala.ativa !== false);
        if (activeRank !== 0) return activeRank;

        const statusRank = { critical: 2, warning: 1, ok: 0 };
        const statusDiff = statusRank[b.status] - statusRank[a.status];
        if (statusDiff !== 0) return statusDiff;

        return a.sala.nome.localeCompare(b.sala.nome);
      });
  }, [rooms, search, statusFilter, typeFilter]);

  const isEditing = Boolean(editingSalaId);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const resetForm = () => {
    setEditingSalaId(null);
    setFormData(DEFAULT_FORM);
  };

  const loadSalaIntoForm = (sala: SalaRecord) => {
    setEditingSalaId(sala.id);
    setFormData({
      codigo: sala.codigo || '',
      nome: sala.nome || '',
      tipo: sala.tipo || 'cultivo',
      ativa: sala.ativa !== false,
      descricao: sala.descricao || '',
    });
    scrollToForm();
  };

  const loadOperationalData = useCallback(async () => {
    setLoadingOperational(true);
    setOperationalError(null);

    try {
      await fetchSalas();

      const [lotesResult, sensoresResult, atuadoresResult] = await Promise.allSettled([
        fetchServer('/lotes'),
        fetchServer('/sensores/latest?hours=168'),
        fetchServer('/controladores'),
      ]);

      const issues: string[] = [];

      if (lotesResult.status === 'fulfilled') {
        setLotes((lotesResult.value.lotes || []) as RoomLote[]);
      } else {
        console.warn('Falha ao carregar lotes para salas:', lotesResult.reason);
        setLotes([]);
        issues.push('lotes');
      }

      if (sensoresResult.status === 'fulfilled') {
        setSensores((sensoresResult.value.sensores || []) as RoomSensorMonitor[]);
      } else {
        console.warn('Falha ao carregar sensores para salas:', sensoresResult.reason);
        setSensores([]);
        issues.push('sensores');
      }

      if (atuadoresResult.status === 'fulfilled') {
        setAtuadores((atuadoresResult.value.controladores || []) as RoomController[]);
      } else {
        console.warn('Falha ao carregar atuadores para salas:', atuadoresResult.reason);
        setAtuadores([]);
        issues.push('atuadores');
      }

      if (issues.length > 0) {
        setOperationalError(`Alguns blocos operacionais não foram carregados (${issues.join(', ')}).`);
      }
    } catch (error: any) {
      console.error('Erro ao carregar visão operacional por sala:', error);
      setOperationalError(error?.message || 'Não foi possível montar a operação por sala.');
      setLotes([]);
      setSensores([]);
      setAtuadores([]);
    } finally {
      setLoadingOperational(false);
    }
  }, [fetchSalas]);

  useEffect(() => {
    void loadOperationalData();
  }, [loadOperationalData]);

  useEffect(() => {
    if (!isRoomLinkDebugEnabled()) return;

    console.info('[rooms] Salas page state', {
      salas: salas.length,
      rooms: rooms.length,
      lotes: lotes.length,
      sensores: sensores.length,
      atuadores: atuadores.length,
      filteredRooms: filteredRooms.length,
    });
  }, [atuadores.length, filteredRooms.length, lotes.length, rooms.length, salas.length, sensores.length]);

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
      await loadOperationalData();
    } catch (submitError) {
      console.error('Erro ao salvar sala:', submitError);
    }
  };

  const handleToggleStatus = async (sala: SalaRecord) => {
    try {
      await fetchServer(`/salas/${sala.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ativa: !(sala.ativa !== false),
        }),
      });

      toast.success(`Sala ${sala.ativa !== false ? 'desativada' : 'ativada'} com sucesso!`);
      await loadOperationalData();
    } catch (toggleError: any) {
      console.error('Erro ao atualizar status da sala:', toggleError);
      toast.error(toggleError?.message || 'Erro ao atualizar status da sala.');
    }
  };

  if ((salasLoading || loadingOperational) && rooms.length === 0 && salas.length === 0) {
    return (
      <div className="rooms-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#375328]" />
      </div>
    );
  }

  return (
    <div className="rooms-page">
      {(salasError || operationalError) && (
        <div className="rooms-inline-alert rooms-inline-alert--danger">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <strong>Falha parcial ao carregar salas</strong>
            <p>{salasError?.message || operationalError}</p>
          </div>
        </div>
      )}

      <section className="rooms-toolbar-shell">
        <div className="rooms-toolbar-copy">
          <span className="rooms-kicker">Operação por sala</span>
          <h1 className="rooms-title">Salas</h1>
          <p className="rooms-copy">
            Sala passa a ser a unidade principal de monitoramento, automação, sensores, atuadores e lotes.
          </p>
        </div>

        <div className="rooms-toolbar-controls">
          <label className="rooms-search" aria-label="Buscar sala">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar sala, lote, atuador..."
            />
          </label>

          <Select value={statusFilter} onValueChange={(value: 'todos' | 'critical' | 'warning' | 'ok') => setStatusFilter(value)}>
            <SelectTrigger className="rooms-toolbar-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
              <SelectItem value="warning">Atenção</SelectItem>
              <SelectItem value="ok">OK</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="rooms-toolbar-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os tipos</SelectItem>
              {roomTypeOptions.map((tipo) => (
                <SelectItem key={tipo} value={tipo || 'sem-tipo'}>
                  {getRoomTypeLabel(tipo)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => void loadOperationalData()}>
            <RefreshCcw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>

          <Button
            className="bg-[#375328] hover:bg-[#2e4520]"
            onClick={() => {
              resetForm();
              scrollToForm();
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova sala
          </Button>
        </div>
      </section>

      <section className="rooms-summary-grid">
        {summaryCards.map((card) => (
          <article key={card.label} className={`rooms-summary-card rooms-summary-card--${card.tone}`}>
            <span className="rooms-summary-card__label">{card.label}</span>
            <strong className="rooms-summary-card__value">{card.value}</strong>
            <p className="rooms-summary-card__meta">{card.meta}</p>
          </article>
        ))}
      </section>

      <section className="rooms-section">
        <header className="rooms-section__header">
          <div>
            <span className="rooms-section__kicker">Monitoramento central</span>
            <h2 className="rooms-section__title">Mapa operacional das salas</h2>
            <p className="rooms-section__copy">
              Leituras agregadas por sala, infraestrutura disponível, automação ativa e lotes atualmente vinculados.
            </p>
          </div>
          <span className="rooms-section__count">{filteredRooms.length} sala(s)</span>
        </header>

        {filteredRooms.length === 0 ? (
          <div className="rooms-empty">
            <strong>Nenhuma sala encontrada</strong>
            <p>Ajuste os filtros ou cadastre a primeira sala para iniciar o monitoramento operacional.</p>
          </div>
        ) : (
          <div className="rooms-card-grid">
            {filteredRooms.map((room) => {
              const activeRule = room.rules.find((rule) => rule.active);
              const isInactive = room.sala.ativa === false;
              const totalSensors = room.sensores.length;
              const roomAlertCopy = getStatusCopy(room);
              const roomAlertContext = getStatusContext(room);

              return (
                <article
                  key={room.sala.id}
                  className={`room-card room-card--${room.status}${isInactive ? ' room-card--inactive' : ''}`}
                >
                  <header className="room-card__header">
                    <div>
                      <span className="room-card__eyebrow">{room.sala.codigo}</span>
                      <h3 className="room-card__title">{room.sala.nome}</h3>
                      <p className="room-card__subtitle">
                        {getRoomTypeLabel(room.sala.tipo)} • {getPhaseContext(room)}
                      </p>
                    </div>

                    <div className="room-card__status-stack">
                      <span className={`room-status-chip room-status-chip--${room.status}`}>
                        {room.statusLabel}
                      </span>
                      <span className={`room-status-chip ${isInactive ? 'room-status-chip--inactive' : 'room-status-chip--ghost'}`}>
                        {isInactive ? 'Inativa' : 'Ativa'}
                      </span>
                    </div>
                  </header>

                  <div className="room-card__metric-grid">
                    <div className="room-card__metric">
                      <span className="room-card__metric-label">Temp média</span>
                      <strong className="room-card__metric-value">
                        <Thermometer className="h-4 w-4" />
                        {formatMetric(room.mediaTemperatura, '°C', 1)}
                      </strong>
                    </div>
                    <div className="room-card__metric">
                      <span className="room-card__metric-label">Umidade média</span>
                      <strong className="room-card__metric-value">
                        <Droplets className="h-4 w-4" />
                        {formatMetric(room.mediaUmidade, '%', 0)}
                      </strong>
                    </div>
                    <div className="room-card__metric">
                      <span className="room-card__metric-label">CO2 médio</span>
                      <strong className="room-card__metric-value">
                        <Wind className="h-4 w-4" />
                        {formatMetric(room.mediaCo2, ' ppm', 0)}
                      </strong>
                    </div>
                  </div>

                  <div className="room-card__infra-grid">
                    <div className="room-card__infra-item">
                      <span className="room-card__infra-label">Sensores online</span>
                      <strong className="room-card__infra-value">
                        <Radio className="h-4 w-4" />
                        {room.sensoresOnline}/{totalSensors}
                      </strong>
                    </div>
                    <div className="room-card__infra-item">
                      <span className="room-card__infra-label">Atuadores</span>
                      <strong className="room-card__infra-value">
                        <Cpu className="h-4 w-4" />
                        {room.atuadores.length}
                      </strong>
                    </div>
                    <div className="room-card__infra-item">
                      <span className="room-card__infra-label">Lotes ativos</span>
                      <strong className="room-card__infra-value">
                        <Boxes className="h-4 w-4" />
                        {room.lotesAtivos}
                      </strong>
                    </div>
                  </div>

                  <div className={`room-card__alert room-card__alert--${room.status}`}>
                    <div>
                      <span className="room-card__alert-label">Leitura operacional</span>
                      <strong className="room-card__alert-title">{roomAlertCopy}</strong>
                    </div>
                    <p className="room-card__alert-copy">{roomAlertContext}</p>
                  </div>

                  <div className="room-card__rule-row">
                    <span className="room-card__rule-chip">
                      {room.lotesAtivos} lote(s) em monitoramento
                    </span>
                    <span className="room-card__rule-chip">
                      {activeRule ? activeRule.title : 'Automação estável'}
                    </span>
                    <span className="room-card__rule-chip">
                      ref. {room.ownership.primaryReference}
                    </span>
                  </div>

                  <div className="room-card__actions">
                    <Link to={`/salas/${room.sala.id}`} className={`room-card__primary-action room-card__primary-action--${room.status}`}>
                      Ver sala
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => loadSalaIntoForm(room.sala)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => void handleToggleStatus(room.sala)}>
                      <Power className="mr-2 h-4 w-4" />
                      {room.sala.ativa !== false ? 'Desativar' : 'Ativar'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="rooms-manage-grid" ref={formRef}>
        <article className="rooms-manage-card">
          <header className="rooms-manage-card__header">
            <div>
              <span className="rooms-section__kicker">Cadastro</span>
              <h2 className="rooms-manage-card__title">{isEditing ? 'Editar sala' : 'Nova sala'}</h2>
              <p className="rooms-manage-card__copy">
                Estruture a operação vinculando tipo, descrição e status base da sala.
              </p>
            </div>
            {isEditing ? (
              <Button variant="ghost" onClick={resetForm}>
                Nova sala
              </Button>
            ) : null}
          </header>

          <form className="rooms-form" onSubmit={handleSubmit}>
            <div className="rooms-form__grid">
              <div className="space-y-2">
                <Label htmlFor="codigo">Código</Label>
                <Input
                  id="codigo"
                  placeholder="Ex: SALA_02"
                  value={formData.codigo}
                  onChange={(event) => setFormData((current) => ({ ...current, codigo: event.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Sala 2"
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

              <div className="rooms-form__switch-card">
                <div>
                  <p className="rooms-form__switch-title">Sala ativa</p>
                  <p className="rooms-form__switch-copy">Salas inativas permanecem no histórico, mas saem do fluxo operacional.</p>
                </div>
                <Switch
                  checked={formData.ativa}
                  onCheckedChange={(checked) => setFormData((current) => ({ ...current, ativa: checked }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                rows={4}
                placeholder="Observações operacionais da sala, restrições ou notas de automação..."
                value={formData.descricao}
                onChange={(event) => setFormData((current) => ({ ...current, descricao: event.target.value }))}
              />
            </div>

            <Button type="submit" className="w-full bg-[#375328] hover:bg-[#2e4520]" disabled={creating || updating}>
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
        </article>

        <article className="rooms-manage-card">
          <header className="rooms-manage-card__header">
            <div>
              <span className="rooms-section__kicker">Vínculos</span>
              <h2 className="rooms-manage-card__title">Inventário operacional</h2>
              <p className="rooms-manage-card__copy">
                Conferência rápida dos vínculos atuais entre sala, sensores, atuadores e lotes.
              </p>
            </div>
          </header>

          <div className="rooms-manage-list">
            {salas.length === 0 ? (
              <div className="rooms-empty">
                <strong>Nenhuma sala cadastrada</strong>
                <p>Cadastre a primeira sala para começar a vincular sensores, atuadores e lotes.</p>
              </div>
            ) : (
              salas.map((sala) => {
                const room = roomIndex.get(sala.id);
                return (
                  <div key={sala.id} className="rooms-manage-row">
                    <div className="rooms-manage-row__main">
                      <div>
                        <strong>{sala.nome}</strong>
                        <p>
                          {sala.codigo} • {getRoomTypeLabel(sala.tipo)} • {sala.ativa !== false ? 'Ativa' : 'Inativa'}
                        </p>
                      </div>
                      <span className={`room-status-chip room-status-chip--${room?.status || 'ok'}`}>
                        {room?.statusLabel || 'OK'}
                      </span>
                    </div>

                    <div className="rooms-manage-row__stats">
                      <span>{room?.sensoresOnline || 0}/{room?.sensores.length || 0} sensores online</span>
                      <span>{room?.atuadores.length || 0} atuadores</span>
                      <span>{room?.lotesAtivos || 0} lotes ativos</span>
                    </div>

                    <div className="rooms-manage-row__actions">
                      <Button variant="outline" size="sm" onClick={() => loadSalaIntoForm(sala)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Editar
                      </Button>
                      <Link to={`/salas/${sala.id}`} className="rooms-manage-row__link">
                        Abrir detalhe
                      </Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

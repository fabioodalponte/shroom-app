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
  primaryCameraId: '',
};

interface RoomCameraOption {
  id: string;
  nome: string;
  localizacao?: string | null;
  status?: string | null;
  url_stream?: string | null;
}

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

function getRoomTrend(room: RoomOperationalModel, metric: 'temperatura' | 'umidade' | 'co2') {
  const values = room.history
    .map((sample) => sample[metric])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (values.length < 2) {
    return { symbol: '→', label: 'estável' };
  }

  const windowSize = Math.max(1, Math.min(4, Math.floor(values.length / 2)));
  const recent = values.slice(-windowSize);
  const previous = values.slice(-(windowSize * 2), -windowSize);
  const recentAvg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const previousAvg = previous.reduce((sum, value) => sum + value, 0) / previous.length;
  const delta = recentAvg - previousAvg;
  const threshold = metric === 'temperatura' ? 0.35 : metric === 'umidade' ? 2 : 45;

  if (delta > threshold) return { symbol: '↑', label: 'subindo' };
  if (delta < -threshold) return { symbol: '↓', label: 'caindo' };
  return { symbol: '→', label: 'estável' };
}

function getEstimatedCapacity(room: RoomOperationalModel) {
  return Math.max(room.lotesAtivos, room.sensores.length * 2, room.atuadores.length * 3, 6);
}

function getOccupancyPercent(room: RoomOperationalModel) {
  const capacity = getEstimatedCapacity(room);
  if (capacity <= 0) return 0;
  return Math.min(100, Math.round((room.lotesAtivos / capacity) * 100));
}

function getOperationalContext(room: RoomOperationalModel) {
  const productName = room.lotes.find((lote) => lote.produto?.nome)?.produto?.nome;
  const phase = room.lotContext.primaryPhase || 'Sem fase dominante';
  return productName ? `${getRoomTypeLabel(room.sala.tipo)} • ${phase} • ${productName}` : `${getRoomTypeLabel(room.sala.tipo)} • ${phase}`;
}

function getRoomHeadline(room: RoomOperationalModel) {
  const phase = room.lotContext.primaryPhase || getRoomTypeLabel(room.sala.tipo);
  const productName = room.lotes.find((lote) => lote.produto?.nome)?.produto?.nome;
  return productName ? `${phase} • ${productName}` : `${phase} • ${getRoomTypeLabel(room.sala.tipo)}`;
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

function isLegacyOrInactiveRoom(room: RoomOperationalModel) {
  return room.sala.ativa === false || normalizeText(room.sala.tipo) === 'legado';
}

function getOperationalInsight(rooms: RoomOperationalModel[]) {
  if (!rooms.length) {
    return {
      title: 'Nenhuma sala oficial monitorada',
      copy: 'Cadastre ou ative salas para começar a consolidar sensores, atuadores e lotes no painel operacional.',
      meta: 'Sem leitura consolidada',
    };
  }

  const criticalRoom = rooms.find((room) => room.status === 'critical');
  if (criticalRoom) {
    return {
      title: `Prioridade imediata em ${criticalRoom.sala.nome}`,
      copy: criticalRoom.primaryAlert?.description || 'Existe um desvio ambiental pedindo ação rápida para proteger os lotes ativos.',
      meta: `${criticalRoom.lotesAtivos} lote(s) ativos • ${criticalRoom.sensoresOnline}/${criticalRoom.sensores.length} sensores online`,
    };
  }

  const warningRoom = rooms.find((room) => room.status === 'warning');
  if (warningRoom) {
    return {
      title: `${warningRoom.sala.nome} pede ajuste fino`,
      copy: warningRoom.primaryAlert?.description || 'A operação segue estável, mas há sinais de atenção que merecem acompanhamento.',
      meta: `${warningRoom.atuadores.length} atuador(es) • ${warningRoom.rules.filter((rule) => rule.active).length} regra(s) ativa(s)`,
    };
  }

  const totalLots = rooms.reduce((sum, room) => sum + room.lotesAtivos, 0);
  return {
    title: 'Operação estável nas salas oficiais',
    copy: 'As médias ambientais estão coerentes e não há alertas críticos no momento.',
    meta: `${totalLots} lote(s) ativo(s) • ${rooms.length} sala(s) monitorada(s)`,
  };
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
  const [cameras, setCameras] = useState<RoomCameraOption[]>([]);
  const [loadingOperational, setLoadingOperational] = useState(false);
  const [operationalError, setOperationalError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'critical' | 'warning' | 'ok'>('todos');
  const [typeFilter, setTypeFilter] = useState('todos');
  const [showLegacyRooms, setShowLegacyRooms] = useState(false);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);

  const salas = useMemo(() => (data?.salas || []) as SalaRecord[], [data?.salas]);
  const cameraById = useMemo(() => new Map(cameras.map((camera) => [camera.id, camera])), [cameras]);
  const rooms = useMemo(
    () => aggregateRooms({ salas, lotes, sensores, atuadores }),
    [atuadores, lotes, salas, sensores],
  );
  const roomIndex = useMemo(() => new Map(rooms.map((room) => [room.sala.id, room])), [rooms]);
  const officialRooms = useMemo(
    () => rooms.filter((room) => !isLegacyOrInactiveRoom(room)),
    [rooms],
  );
  const legacyRooms = useMemo(
    () => rooms.filter((room) => isLegacyOrInactiveRoom(room)),
    [rooms],
  );
  const summaryCards = useMemo(() => getSummaryCards(officialRooms), [officialRooms]);
  const operationalInsight = useMemo(() => getOperationalInsight(officialRooms), [officialRooms]);

  const roomTypeOptions = useMemo(() => {
    return Array.from(new Set(salas.filter((sala) => sala.ativa !== false && normalizeText(sala.tipo) !== 'legado').map((sala) => sala.tipo).filter(Boolean)))
      .sort((a, b) => normalizeText(a).localeCompare(normalizeText(b)));
  }, [salas]);

  const matchesRoomFilters = useCallback((room: RoomOperationalModel) => {
    const normalizedSearch = normalizeText(search);
    if (statusFilter !== 'todos' && room.status !== statusFilter) return false;
    if (typeFilter !== 'todos' && normalizeText(room.sala.tipo) !== normalizeText(typeFilter)) return false;

    if (!normalizedSearch) return true;

    const haystack = [
      room.sala.nome,
      room.sala.codigo,
      room.sala.tipo,
      room.sala.descricao,
      room.primaryAlert?.title,
      room.primaryAlert?.description,
      room.lotContext.primaryPhase,
      ...room.lotes.map((lote) => `${lote.codigo_lote} ${lote.produto?.nome || ''} ${lote.fase_operacional || ''}`),
      ...room.atuadores.map((atuador) => `${atuador.nome} ${atuador.localizacao || ''}`),
    ]
      .map(normalizeText)
      .join(' ');

    return haystack.includes(normalizedSearch);
  }, [search, statusFilter, typeFilter]);

  const filteredOfficialRooms = useMemo(() => {
    return officialRooms
      .filter(matchesRoomFilters)
      .sort((a, b) => {
        const statusRank = { critical: 2, warning: 1, ok: 0 };
        const statusDiff = statusRank[b.status] - statusRank[a.status];
        if (statusDiff !== 0) return statusDiff;
        return a.sala.nome.localeCompare(b.sala.nome);
      });
  }, [matchesRoomFilters, officialRooms]);

  const filteredLegacyRooms = useMemo(() => {
    return legacyRooms
      .filter(matchesRoomFilters)
      .sort((a, b) => a.sala.nome.localeCompare(b.sala.nome));
  }, [legacyRooms, matchesRoomFilters]);

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
      primaryCameraId: sala.primary_camera_id || '',
    });
    scrollToForm();
  };

  const loadOperationalData = useCallback(async () => {
    setLoadingOperational(true);
    setOperationalError(null);

    try {
      await fetchSalas();

      const [lotesResult, sensoresResult, atuadoresResult, camerasResult] = await Promise.allSettled([
        fetchServer('/lotes'),
        fetchServer('/sensores/latest?hours=168'),
        fetchServer('/controladores'),
        fetchServer('/cameras'),
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

      if (camerasResult.status === 'fulfilled') {
        setCameras((camerasResult.value.cameras || []) as RoomCameraOption[]);
      } else {
        console.warn('Falha ao carregar câmeras para salas:', camerasResult.reason);
        setCameras([]);
        issues.push('cameras');
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
      setCameras([]);
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
      filteredOfficialRooms: filteredOfficialRooms.length,
    });
  }, [atuadores.length, filteredOfficialRooms.length, lotes.length, rooms.length, salas.length, sensores.length]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const payload = {
      codigo: formData.codigo,
      nome: formData.nome,
      tipo: formData.tipo,
      ativa: formData.ativa,
      descricao: formData.descricao,
      primary_camera_id: formData.primaryCameraId || null,
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

  const handleAutomationPlaceholder = (room: RoomOperationalModel) => {
    toast.info(`Automação de ${room.sala.nome}`, {
      description: room.primaryAlert?.description || 'Bloco de automação detalhada será conectado à operação da sala em seguida.',
    });
  };

  if ((salasLoading || loadingOperational) && rooms.length === 0 && salas.length === 0) {
    return (
      <div className="rooms-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#375328]" />
      </div>
    );
  }

  return (
    <div className="rooms-page rooms-page--operations">
      {(salasError || operationalError) && (
        <div className="rooms-inline-alert rooms-inline-alert--danger">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <strong>Falha parcial ao carregar salas</strong>
            <p>{salasError?.message || operationalError}</p>
          </div>
        </div>
      )}

      <section className="rooms-stitch-hero">
        <div className="rooms-stitch-hero__copy">
          <span className="rooms-kicker">Monitoramento operacional</span>
          <h1 className="rooms-title">Salas de cultivo</h1>
          <p className="rooms-copy">
            Monitoramento em tempo real dos ambientes controlados, com leitura rápida de status, ocupação e alertas por sala oficial.
          </p>
        </div>

        <div className="rooms-stitch-hero__actions">
          <Button variant="outline" className="rooms-stitch-hero__filter" onClick={() => setShowFiltersPanel((current) => !current)}>
            <Search className="mr-2 h-4 w-4" />
            Filtrar
          </Button>

          <Button
            className="rooms-stitch-hero__primary"
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

      {showFiltersPanel ? (
        <section className="rooms-stitch-toolbar">
          <label className="rooms-search" aria-label="Buscar sala">
            <Search className="h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar sala..."
            />
          </label>

          <div className="rooms-toolbar-controls">
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
                <SelectValue placeholder="Filtrar tipo" />
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
          </div>
        </section>
      ) : null}

      <section className="rooms-stitch-grid-shell">
        {filteredOfficialRooms.length === 0 ? (
          <div className="rooms-empty">
            <strong>Nenhuma sala encontrada</strong>
            <p>Ajuste os filtros ou cadastre a primeira sala para iniciar o monitoramento operacional.</p>
          </div>
        ) : (
          <div className="rooms-stitch-grid">
            {filteredOfficialRooms.map((room) => {
              const totalSensors = room.sensores.length;
              const roomAlertCopy = getStatusCopy(room);
              const occupancy = getOccupancyPercent(room);
              const tempTrend = getRoomTrend(room, 'temperatura');
              const humidityTrend = getRoomTrend(room, 'umidade');
              const co2Trend = getRoomTrend(room, 'co2');

              return (
                <article
                  key={room.sala.id}
                  className={`room-card room-card--${room.status} room-card--stitch`}
                >
                  <header className="room-card__header room-card__header--stitch">
                    <div>
                      <h3 className="room-card__title">{room.sala.nome}</h3>
                      <p className="room-card__subtitle room-card__subtitle--stitch">{getRoomHeadline(room)}</p>
                    </div>

                    <div className="room-card__status-stack room-card__status-stack--stitch">
                      <span className={`room-status-chip room-status-chip--${room.status}`}>
                        {room.statusLabel}
                      </span>
                    </div>
                  </header>

                  <div className="room-card__metric-grid room-card__metric-grid--stitch">
                    <div className="room-card__metric room-card__metric--stitch">
                      <span className="room-card__metric-label">Temp</span>
                      <strong className="room-card__metric-value">
                        <Thermometer className="h-4 w-4" />
                        {formatMetric(room.mediaTemperatura, '°C', 1)}
                      </strong>
                      <span className={`room-card__trend room-card__trend--${tempTrend.label}`}>{tempTrend.symbol} {tempTrend.label}</span>
                    </div>
                    <div className="room-card__metric room-card__metric--stitch">
                      <span className="room-card__metric-label">Umid</span>
                      <strong className="room-card__metric-value">
                        <Droplets className="h-4 w-4" />
                        {formatMetric(room.mediaUmidade, '%', 0)}
                      </strong>
                      <span className={`room-card__trend room-card__trend--${humidityTrend.label}`}>{humidityTrend.symbol} {humidityTrend.label}</span>
                    </div>
                    <div className="room-card__metric room-card__metric--stitch">
                      <span className="room-card__metric-label">CO2</span>
                      <strong className="room-card__metric-value">
                        <Wind className="h-4 w-4" />
                        {formatMetric(room.mediaCo2, ' ppm', 0)}
                      </strong>
                      <span className={`room-card__trend room-card__trend--${co2Trend.label}`}>{co2Trend.symbol} {co2Trend.label}</span>
                    </div>
                  </div>

                  <div className="room-card__occupancy">
                    <div className="room-card__occupancy-row">
                      <span className="room-card__infra-label">Ocupação total</span>
                      <strong>{occupancy}%</strong>
                    </div>
                    <div className="room-card__occupancy-bar">
                      <div className={`room-card__occupancy-fill room-card__occupancy-fill--${room.status}`} style={{ width: `${occupancy}%` }} />
                    </div>
                  </div>

                  <div className="room-card__footer-grid room-card__footer-grid--stitch">
                    <div className="room-card__footer-stat room-card__footer-stat--stitch">
                      <span className="room-card__infra-label">Sensores</span>
                      <strong className="room-card__infra-value">{totalSensors > 0 ? `${room.sensoresOnline} Online` : 'Sem sensor'}</strong>
                    </div>
                    <div className="room-card__footer-stat room-card__footer-stat--stitch">
                      <span className="room-card__infra-label">Lotes</span>
                      <strong className="room-card__infra-value">{room.lotesAtivos > 0 ? `${room.lotesAtivos} Ativos` : 'Sem lote ativo'}</strong>
                    </div>
                  </div>

                  <div className={`room-card__alert room-card__alert--${room.status} room-card__alert--stitch`}>
                    <div>
                      <span className="room-card__alert-label">Alerta</span>
                      <strong className="room-card__alert-title">{roomAlertCopy}</strong>
                    </div>
                    <p className="room-card__alert-copy">{room.primaryAlert?.description || 'Sem alerta crítico no momento.'}</p>
                  </div>

                  <div className="room-card__actions room-card__actions--stitch">
                    <Link to={`/salas/${room.sala.id}`} className={`room-card__primary-action room-card__primary-action--${room.status}`}>
                      Ver detalhes
                    </Link>
                    <Button className="room-card__secondary-action" onClick={() => handleAutomationPlaceholder(room)}>
                      Automação
                    </Button>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              className="room-card room-card--create room-card--create-stitch"
              onClick={() => {
                resetForm();
                scrollToForm();
              }}
            >
              <span className="room-card__create-icon">
                <Plus className="h-5 w-5" />
              </span>
              <div className="room-card__create-copy">
                <span className="room-card__eyebrow">Expandir operação</span>
                <h3 className="room-card__title">Nova sala</h3>
                <p className="room-card__subtitle">
                  Clique para cadastrar uma nova sala oficial e ampliar o ambiente monitorado sem criar estruturas paralelas.
                </p>
              </div>
            </button>
          </div>
        )}
      </section>

      <section className="rooms-secondary-shell">
        <article className="rooms-insight-card rooms-insight-card--wide rooms-insight-card--stitch">
          <div className="rooms-insight-card__copy">
            <span className="rooms-section__kicker">Insights do laboratório</span>
            <h2 className="rooms-section__title">Insights do laboratório</h2>
            <p className="rooms-section__copy">"{operationalInsight.copy}"</p>
          </div>
          <div className="rooms-insight-card__metric">
            <strong>{operationalInsight.title}</strong>
            <span>{operationalInsight.meta}</span>
            <div className="rooms-insight-card__actions">
              <button type="button">Aplicar correção IA</button>
              <button type="button">Ignorar alerta</button>
            </div>
          </div>
        </article>

        <div className="rooms-manage-grid" ref={formRef}>
        <article className="rooms-manage-card">
          <header className="rooms-manage-card__header">
            <div>
              <span className="rooms-section__kicker">Cadastro</span>
              <h2 className="rooms-manage-card__title">{isEditing ? 'Editar sala' : 'Cadastro de sala'}</h2>
              <p className="rooms-manage-card__copy">
                O bloco de cadastro fica separado da operação para manter a leitura do painel limpa e orientada à ação.
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
              <Label htmlFor="primary-camera">Câmera principal</Label>
              <Select
                value={formData.primaryCameraId || 'sem-camera'}
                onValueChange={(value) => setFormData((current) => ({ ...current, primaryCameraId: value === 'sem-camera' ? '' : value }))}
              >
                <SelectTrigger id="primary-camera">
                  <SelectValue placeholder="Selecionar câmera cadastrada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem-camera">Sem câmera vinculada</SelectItem>
                  {cameras.map((camera) => (
                    <SelectItem key={camera.id} value={camera.id}>
                      {camera.nome} {camera.localizacao ? `• ${camera.localizacao}` : ''} {camera.status ? `• ${camera.status}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

        <article className="rooms-manage-card rooms-manage-card--secondary">
          <header className="rooms-manage-card__header">
            <div>
              <span className="rooms-section__kicker">Manutenção</span>
              <h2 className="rooms-manage-card__title">Salas cadastradas</h2>
              <p className="rooms-manage-card__copy">
                Ajustes e manutenção ficam separados da operação principal para não competir com o dashboard das salas.
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
                const linkedCamera = sala.primary_camera_id ? cameraById.get(sala.primary_camera_id) : null;
                return (
                  <div key={sala.id} className="rooms-manage-row">
                    <div className="rooms-manage-row__main">
                      <div>
                        <strong>{sala.nome}</strong>
                        <p>
                          {sala.codigo} • {getRoomTypeLabel(sala.tipo)} • {sala.ativa !== false ? 'Ativa' : 'Inativa'}
                        </p>
                        <p>
                          {linkedCamera ? `Câmera principal: ${linkedCamera.nome}` : 'Câmera principal não vinculada'}
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
                      <Button variant="outline" size="sm" onClick={() => void handleToggleStatus(sala)}>
                        <Power className="mr-2 h-4 w-4" />
                        {sala.ativa !== false ? 'Desativar' : 'Ativar'}
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
        </div>
      </section>

      {legacyRooms.length > 0 ? (
        <section className="rooms-section rooms-section--legacy">
          <header className="rooms-section__header">
            <div>
              <span className="rooms-section__kicker">Secundário</span>
              <h2 className="rooms-section__title">Legado / Inativas</h2>
              <p className="rooms-section__copy">
                Salas inativas, legadas ou derivadas de fallback ficam isoladas aqui para não poluir a operação principal.
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowLegacyRooms((current) => !current)}>
              {showLegacyRooms ? 'Ocultar' : 'Mostrar'}
            </Button>
          </header>

          {showLegacyRooms ? (
            filteredLegacyRooms.length > 0 ? (
              <div className="rooms-legacy-list">
                {filteredLegacyRooms.map((room) => (
                  <article key={room.sala.id} className="rooms-legacy-row">
                    <div>
                      <strong>{room.sala.nome}</strong>
                      <p>{room.sala.codigo} • {getRoomTypeLabel(room.sala.tipo)} • {room.sala.ativa === false ? 'Inativa' : 'Legado / fallback'}</p>
                    </div>
                    <div className="rooms-legacy-row__meta">
                      <span>{room.lotesAtivos} lote(s)</span>
                      <span>{room.sensoresOnline}/{room.sensores.length} sensores</span>
                      <Link to={`/salas/${room.sala.id}`} className="rooms-manage-row__link">Abrir</Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rooms-empty">
                <strong>Nenhuma sala legada visível com os filtros atuais</strong>
                <p>Ajuste a busca ou os filtros se precisar revisar vínculos antigos.</p>
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

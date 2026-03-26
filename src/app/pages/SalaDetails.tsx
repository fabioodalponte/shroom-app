import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Bot,
  Boxes,
  Building2,
  CheckCircle2,
  Cpu,
  Droplets,
  Loader2,
  Radio,
  Thermometer,
  Wind,
  XCircle,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../../components/ui/button';
import { fetchServer } from '../../utils/supabase/client';
import {
  aggregateRooms,
  isRoomLinkDebugEnabled,
  type RoomController,
  type RoomLote,
  type RoomOperationalModel,
  type RoomSensorMonitor,
  type SalaRecord,
} from '../lib/room-operations';

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

function normalizeRoomAlias(value?: string | null) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function parseDateValue(value?: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatRelativeTime(value?: Date | null) {
  if (!value) return 'Sem atualização';
  return formatDistanceToNowStrict(value, {
    addSuffix: true,
    locale: ptBR,
  });
}

function buildChartData(room: RoomOperationalModel | null) {
  if (!room?.history?.length) return [];

  const step = room.history.length > 48 ? Math.ceil(room.history.length / 48) : 1;
  return room.history
    .filter((_, index) => index % step === 0 || index === room.history.length - 1)
    .map((sample) => {
      const timestamp = parseDateValue(sample.timestamp) || new Date();
      return {
        label: format(timestamp, 'dd/MM HH:mm'),
        temperatura: sample.temperatura,
        umidade: sample.umidade,
        co2: sample.co2,
      };
    });
}

function buildHistoryBars(room: RoomOperationalModel | null, metric: 'temperatura' | 'umidade' | 'co2') {
  if (!room?.history?.length) return [];

  const points = room.history
    .map((sample) => sample[metric])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  if (!points.length) return [];

  const buckets = Math.min(7, points.length);
  const bucketSize = Math.max(1, Math.floor(points.length / buckets));
  const series = Array.from({ length: buckets }, (_, index) => {
    const start = index * bucketSize;
    const end = index === buckets - 1 ? points.length : start + bucketSize;
    const slice = points.slice(start, end);
    const value = slice.reduce((sum, item) => sum + item, 0) / slice.length;
    return Number.isFinite(value) ? value : 0;
  });

  const min = Math.min(...series);
  const max = Math.max(...series);
  return series.map((value) => ({
    value,
    height: max === min ? 60 : 28 + ((value - min) / (max - min || 1)) * 52,
  }));
}

function buildRoomInsight(room: RoomOperationalModel) {
  if (room.primaryAlert) {
    return {
      title: `Prioridade atual: ${room.primaryAlert.title}`,
      copy: room.primaryAlert.description,
      meta: `${room.lotesAtivos} lote(s) ativos • ${room.sensoresOnline}/${room.sensores.length} sensores online`,
    };
  }

  const activeRule = room.rules.find((rule) => rule.active);
  if (activeRule) {
    return {
      title: activeRule.title,
      copy: activeRule.description,
      meta: `${room.atuadores.length} atuador(es) disponíveis • fase dominante: ${room.lotContext.primaryPhase || 'sem fase'}`,
    };
  }

  return {
    title: 'Sala operando de forma estável',
    copy: 'Sem alertas prioritários no momento. As médias ambientais e a coerência entre sensores sustentam a automação da sala.',
    meta: `${room.lotesAtivos} lote(s) ativos • ${room.atuadores.length} atuador(es) vinculados`,
  };
}

export function SalaDetails() {
  const { id } = useParams();
  const [salas, setSalas] = useState<SalaRecord[]>([]);
  const [lotes, setLotes] = useState<RoomLote[]>([]);
  const [sensores, setSensores] = useState<RoomSensorMonitor[]>([]);
  const [atuadores, setAtuadores] = useState<RoomController[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const [salasResult, lotesResult, sensoresResult, atuadoresResult] = await Promise.allSettled([
        fetchServer('/salas'),
        fetchServer('/lotes'),
        fetchServer('/sensores/latest?hours=168'),
        fetchServer('/controladores'),
      ]);

      if (salasResult.status === 'rejected') {
        throw salasResult.reason;
      }

      setSalas((salasResult.value.salas || []) as SalaRecord[]);

      if (lotesResult.status === 'fulfilled') {
        setLotes((lotesResult.value.lotes || []) as RoomLote[]);
      } else {
        console.warn('Falha ao carregar lotes da sala:', lotesResult.reason);
        setLotes([]);
      }

      if (sensoresResult.status === 'fulfilled') {
        setSensores((sensoresResult.value.sensores || []) as RoomSensorMonitor[]);
      } else {
        console.warn('Falha ao carregar sensores da sala:', sensoresResult.reason);
        setSensores([]);
      }

      if (atuadoresResult.status === 'fulfilled') {
        setAtuadores((atuadoresResult.value.controladores || []) as RoomController[]);
      } else {
        console.warn('Falha ao carregar atuadores da sala:', atuadoresResult.reason);
        setAtuadores([]);
      }
    } catch (error: any) {
      console.error('Erro ao carregar detalhe da sala:', error);
      setErrorMessage(error?.message || 'Não foi possível carregar os dados da sala.');
      setSalas([]);
      setLotes([]);
      setSensores([]);
      setAtuadores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const rooms = useMemo(
    () => aggregateRooms({ salas, lotes, sensores, atuadores }),
    [atuadores, lotes, salas, sensores],
  );
  const room = useMemo(() => {
    const target = normalizeRoomAlias(id);
    return rooms.find((item) => {
      return [
        item.sala.id,
        item.sala.codigo,
        item.sala.nome,
      ].some((candidate) => normalizeRoomAlias(candidate) === target);
    }) || null;
  }, [id, rooms]);
  const chartData = useMemo(() => buildChartData(room), [room]);
  const roomInsight = useMemo(() => (room ? buildRoomInsight(room) : null), [room]);
  const temperatureBars = useMemo(() => buildHistoryBars(room, 'temperatura'), [room]);
  const humidityBars = useMemo(() => buildHistoryBars(room, 'umidade'), [room]);

  useEffect(() => {
    if (!isRoomLinkDebugEnabled()) return;

    if (!room) {
      console.warn('[rooms] SalaDetails unresolved room', {
        routeId: id,
        availableRooms: rooms.map((item) => ({
          id: item.sala.id,
          codigo: item.sala.codigo,
          nome: item.sala.nome,
        })),
      });
      return;
    }

    console.info('[rooms] SalaDetails room resolved', {
      routeId: id,
      sala: room.sala.nome,
      diagnostics: room.diagnostics,
    });
  }, [id, room, rooms]);

  if (loading) {
    return (
      <div className="rooms-loading">
        <Loader2 className="h-8 w-8 animate-spin text-[#375328]" />
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="room-detail-page">
        <div className="rooms-inline-alert rooms-inline-alert--danger">
          <AlertTriangle className="h-4 w-4" />
          <div>
            <strong>Falha ao carregar detalhe da sala</strong>
            <p>{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="room-detail-page">
        <div className="rooms-empty">
          <strong>Sala não encontrada</strong>
          <p>Verifique o identificador da sala ou volte para a listagem operacional.</p>
          <Link to="/salas" className="room-detail-back room-detail-back--inline">
            <ArrowLeft className="h-4 w-4" />
            Voltar para salas
          </Link>
        </div>
      </div>
    );
  }

  const offlineSensors = room.sensores.length - room.sensoresOnline;
  const activeRules = room.rules.filter((rule) => rule.active).length;
  const highlightedLot = room.lotContext.highlightedLotCode || room.lotes[0]?.codigo_lote || 'Sem lote ativo';

  return (
    <div className="room-detail-page">
      <div className="room-detail-back-row">
        <Link to="/salas" className="room-detail-back">
          <ArrowLeft className="h-4 w-4" />
          Voltar para salas
        </Link>
        <div className="room-detail-back-row__actions">
          {room.lotesAtivos > 0 ? (
            <Link to="/lotes" className="room-detail-back room-detail-back--secondary">
              <Boxes className="h-4 w-4" />
              Ver lotes
            </Link>
          ) : null}
          <Button variant="outline" onClick={() => void loadData()}>
            Atualizar leitura
          </Button>
        </div>
      </div>

      <section className={`room-detail-hero room-detail-hero--${room.status}`}>
        <div className="room-detail-hero__copy">
          <span className="rooms-kicker">Operação por sala</span>
          <h1 className="room-detail-hero__title">{room.sala.nome}</h1>
          <div className="room-detail-hero__chips">
            <span className={`room-status-chip room-status-chip--${room.status}`}>{room.statusLabel}</span>
            <span className="room-status-chip room-status-chip--ghost">{getRoomTypeLabel(room.sala.tipo)}</span>
            {room.lotContext.primaryPhase ? <span className="room-status-chip room-status-chip--ghost">{room.lotContext.primaryPhase}</span> : null}
          </div>
          <p className="room-detail-hero__description">
            {room.sala.descricao || 'Sala estruturada para monitoramento ambiental, automação e operação por média consolidada.'}
          </p>
          <div className="room-detail-hero__context">
            <span>{getRoomTypeLabel(room.sala.tipo)}</span>
            <span>{room.lotContext.primaryPhase || 'Sem fase dominante'}</span>
            <span>{highlightedLot}</span>
          </div>
        </div>

        <div className="room-detail-hero__stats">
          <article className="room-detail-top-card">
            <span>Sensores online</span>
            <strong>{room.sensoresOnline}/{room.sensores.length}</strong>
            <p>{offlineSensors > 0 ? `${offlineSensors} sensor(es) offline` : 'Todos os sensores operacionais'}</p>
          </article>
          <article className="room-detail-top-card">
            <span>Atuadores</span>
            <strong>{room.atuadores.length}</strong>
            <p>{room.atuadores.length > 0 ? 'controladores vinculados à sala' : 'sem atuador vinculado'}</p>
          </article>
          <article className="room-detail-top-card">
            <span>Lotes ativos</span>
            <strong>{room.lotesAtivos}</strong>
            <p>{room.lotes.length} lote(s) total na sala</p>
          </article>
          <article className="room-detail-top-card">
            <span>Regras ativas</span>
            <strong>{activeRules}</strong>
            <p>{room.primaryAlert?.title || 'Sem desvio prioritário agora'}</p>
          </article>
        </div>
      </section>

      <section className="room-detail-overview">
        <article className="room-detail-section room-detail-section--environment">
          <header className="room-detail-section__header">
            <div>
              <span className="rooms-section__kicker">Ambiente</span>
              <h2 className="room-detail-section__title">Médias ambientais</h2>
            </div>
            <span className="room-status-chip room-status-chip--ghost">
              {room.history.length > 0 ? `Atualizado ${formatRelativeTime(parseDateValue(room.history[room.history.length - 1]?.timestamp))}` : 'Sem leitura'}
            </span>
          </header>

          <div className="room-detail-environment-grid">
            <article className="room-detail-environment-card">
              <span>Temperatura</span>
              <strong>
                <Thermometer className="h-4 w-4" />
                {formatMetric(room.mediaTemperatura, '°C', 1)}
              </strong>
              <p>Faixa-alvo: {room.targets.temperatura.min}°C a {room.targets.temperatura.max}°C</p>
            </article>
            <article className="room-detail-environment-card">
              <span>Umidade</span>
              <strong>
                <Droplets className="h-4 w-4" />
                {formatMetric(room.mediaUmidade, '%', 0)}
              </strong>
              <p>Faixa-alvo: {room.targets.umidade.min}% a {room.targets.umidade.max}%</p>
            </article>
            <article className="room-detail-environment-card">
              <span>CO2</span>
              <strong>
                <Wind className="h-4 w-4" />
                {formatMetric(room.mediaCo2, ' ppm', 0)}
              </strong>
              <p>Meta abaixo de {room.targets.co2.idealMax} ppm</p>
            </article>
            <article className="room-detail-environment-card">
              <span>Luminosidade</span>
              <strong>
                <Radio className="h-4 w-4" />
                {formatMetric(room.mediaLuminosidade, ' lux', 0)}
              </strong>
              <p>
                {room.mediaLuminosidade !== null
                  ? room.targets.luminosidade.min !== null || room.targets.luminosidade.max !== null
                    ? `Faixa-alvo: ${room.targets.luminosidade.min ?? 0} a ${room.targets.luminosidade.max ?? '∞'} lux`
                    : 'Sem faixa configurada para luz'
                  : 'Sem leitura de luminosidade'}
              </p>
            </article>
          </div>
        </article>

        <article className="room-detail-history-card">
          <header className="room-detail-section__header">
            <div>
              <span className="rooms-section__kicker">Histórico</span>
              <h2 className="room-detail-section__title">Últimos 7 dias</h2>
            </div>
          </header>

          <div className="room-detail-history-card__series">
            <div>
              <div className="room-detail-history-card__row">
                <span>Temp</span>
                <strong>{formatMetric(room.mediaTemperatura, '°C', 1)} avg</strong>
              </div>
              <div className="room-detail-history-card__bars">
                {temperatureBars.length > 0 ? temperatureBars.map((bar, index) => (
                  <span key={`temp-${index}`} style={{ height: `${bar.height}%` }} />
                )) : <div className="room-detail-empty room-detail-empty--compact">Sem histórico</div>}
              </div>
            </div>
            <div>
              <div className="room-detail-history-card__row">
                <span>Umid</span>
                <strong>{formatMetric(room.mediaUmidade, '%', 0)} avg</strong>
              </div>
              <div className="room-detail-history-card__bars room-detail-history-card__bars--humidity">
                {humidityBars.length > 0 ? humidityBars.map((bar, index) => (
                  <span key={`humid-${index}`} style={{ height: `${bar.height}%` }} />
                )) : <div className="room-detail-empty room-detail-empty--compact">Sem histórico</div>}
              </div>
            </div>
          </div>
        </article>
      </section>

      <div className="room-detail-layout">
        <div className="room-detail-main">
          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Telemetria</span>
                <h2 className="room-detail-section__title">Sensores individuais</h2>
              </div>
              {room.divergence.temperatura >= 1.5 || room.divergence.umidade >= 8 || room.divergence.co2 >= 120 ? (
                <span className="room-status-chip room-status-chip--warning">Desvio detectado</span>
              ) : null}
            </header>

            {room.sensores.length === 0 ? (
              <div className="room-detail-empty">Nenhum sensor vinculado ainda.</div>
            ) : (
              <div className="room-sensor-list room-sensor-list--detail">
                {room.sensores.map((sensor) => (
                  <article key={sensor.key} className={`room-sensor-card room-sensor-card--detail ${sensor.online ? '' : 'room-sensor-card--offline'}`}>
                    <div className="room-sensor-card__head">
                      <div>
                        <strong>{sensor.label}</strong>
                        <p>{sensor.sourceLabel}</p>
                      </div>
                      <span className={`room-status-chip ${sensor.online ? 'room-status-chip--ok' : 'room-status-chip--critical'}`}>
                        {sensor.online ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="room-sensor-card__metrics room-sensor-card__metrics--detail">
                      <span>{formatMetric(sensor.temperatura, '°C', 1)}</span>
                      <span>{formatMetric(sensor.umidade, '%', 0)}</span>
                      <span>{formatMetric(sensor.co2, ' ppm', 0)}</span>
                    </div>

                    <div className="room-sensor-card__footer">
                      <span>Última leitura {formatRelativeTime(sensor.lastSeen)}</span>
                      <span>Risco {sensor.scoreRisco.toFixed(0)}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Infraestrutura</span>
                <h2 className="room-detail-section__title">Atuadores & hardware</h2>
              </div>
            </header>

            {room.atuadores.length === 0 ? (
              <div className="room-detail-empty">Nenhum atuador vinculado à sala.</div>
            ) : (
              <div className="room-actuator-grid">
                {room.atuadores.map((atuador) => (
                  <article key={atuador.id} className="room-actuator-card room-actuator-card--tile">
                    <div className="room-actuator-card__head">
                      <div className="room-actuator-card__title-row">
                        <Cpu className="h-4 w-4" />
                        <strong>{atuador.nome}</strong>
                      </div>
                      <button type="button" className={`room-toggle ${normalizeText(atuador.status) === 'online' ? 'room-toggle--active' : ''}`} aria-label={`Estado de ${atuador.nome}`}>
                        <span />
                      </button>
                    </div>
                    <div className="room-actuator-card__meta room-actuator-card__meta--tile">
                      <span>{atuador.tipo || 'Tipo não informado'}</span>
                      <span>{atuador.modo_padrao || 'remote'}</span>
                      <span>{normalizeText(atuador.status) === 'online' ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="room-detail-dual-grid">
          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Automação</span>
                <h2 className="room-detail-section__title">Regras de decisão da sala</h2>
              </div>
            </header>

            <div className="room-rule-list">
              {room.rules.map((rule) => (
                <article key={rule.id} className={`room-rule-card room-rule-card--${rule.tone}`}>
                  <div className="room-rule-card__head">
                    <div className="room-rule-card__title-row">
                      <Bot className="h-4 w-4" />
                      <strong>{rule.title}</strong>
                    </div>
                    <span className={`room-status-chip room-status-chip--${rule.tone}`}>
                      {rule.active ? 'Ativa' : 'Estável'}
                    </span>
                  </div>
                  <p>{rule.description}</p>
                </article>
              ))}
            </div>
          </section>
          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Produção</span>
                <h2 className="room-detail-section__title">Lotes ativos</h2>
              </div>
            </header>

            {room.lotes.length === 0 ? (
              <div className="room-detail-empty">Nenhum lote vinculado a esta sala.</div>
            ) : (
              <div className="room-lote-list">
                {room.lotes.map((lote) => (
                  <Link key={lote.id} to={`/lotes/${lote.id}`} className="room-lote-card">
                    <div className="room-lote-card__main">
                      <div>
                        <strong>{lote.codigo_lote}</strong>
                        <p>{lote.produto?.nome || 'Produto não informado'}</p>
                      </div>
                      <span className="room-status-chip room-status-chip--ghost">
                        {lote.fase_operacional || 'Sem fase'}
                      </span>
                    </div>
                    <div className="room-lote-card__meta">
                      <span>Status: {lote.status || 'em andamento'}</span>
                      <span>Blocos: {lote.blocos_resumo?.total || 0}</span>
                      <span>
                        Colheita: {lote.data_previsao_colheita ? format(parseDateValue(lote.data_previsao_colheita) || new Date(), 'dd/MM/yyyy') : 'não prevista'}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
          </div>
          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Alertas</span>
                <h2 className="room-detail-section__title">Alertas recentes</h2>
              </div>
            </header>
            {room.alerts.length === 0 ? (
              <div className="room-detail-empty">Nenhum alerta ativo nesta sala.</div>
            ) : (
              <div className="room-alert-list room-alert-list--stacked">
                {room.alerts.map((alert) => (
                  <article key={alert.id} className={`room-alert-card room-alert-card--${alert.tone}`}>
                    <div className="room-alert-card__icon">
                      {alert.tone === 'critical' ? <XCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </div>
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          {chartData.length > 0 ? (
            <section className="room-detail-section">
              <header className="room-detail-section__header">
                <div>
                  <span className="rooms-section__kicker">Histórico</span>
                  <h2 className="room-detail-section__title">Gráficos ambientais</h2>
                </div>
              </header>

              <div className="room-chart-grid">
                <article className="room-chart-card">
                  <header className="room-chart-card__header">
                    <strong>Temperatura</strong>
                    <span>{chartData.length} leituras</span>
                  </header>
                  <div className="room-chart-card__canvas">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ebe5d8" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7d847a' }} minTickGap={30} />
                        <YAxis tick={{ fontSize: 11, fill: '#7d847a' }} width={32} />
                        <Tooltip />
                        <Area type="monotone" dataKey="temperatura" stroke="#375328" fill="rgba(55, 83, 40, 0.16)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="room-chart-card">
                  <header className="room-chart-card__header">
                    <strong>Umidade</strong>
                    <span>Média consolidada</span>
                  </header>
                  <div className="room-chart-card__canvas">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ebe5d8" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7d847a' }} minTickGap={30} />
                        <YAxis tick={{ fontSize: 11, fill: '#7d847a' }} width={32} />
                        <Tooltip />
                        <Area type="monotone" dataKey="umidade" stroke="#a56d00" fill="rgba(165, 109, 0, 0.14)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                <article className="room-chart-card">
                  <header className="room-chart-card__header">
                    <strong>CO2</strong>
                    <span>Ambiente da sala</span>
                  </header>
                  <div className="room-chart-card__canvas">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ebe5d8" />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7d847a' }} minTickGap={30} />
                        <YAxis tick={{ fontSize: 11, fill: '#7d847a' }} width={42} />
                        <Tooltip />
                        <Line type="monotone" dataKey="co2" stroke="#1f4b69" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </article>
              </div>
            </section>
          ) : null}

          <section className="room-detail-section room-detail-section--insight room-detail-section--insight-wide">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Insight operacional</span>
                <h2 className="room-detail-section__title">Leitura consolidada da sala</h2>
              </div>
            </header>

            <div className="room-context-card room-context-card--insight room-context-card--insight-wide">
              <div className="room-context-card__grid">
                <div className="room-context-card__item">
                  <Building2 className="h-4 w-4" />
                  <span>{room.sala.nome}</span>
                </div>
                <div className="room-context-card__item">
                  <Boxes className="h-4 w-4" />
                  <span>{room.lotesAtivos} lote(s) ativo(s)</span>
                </div>
                <div className="room-context-card__item">
                  <BellRing className="h-4 w-4" />
                  <span>{room.primaryAlert?.title || 'Sem alerta prioritário'}</span>
                </div>
                <div className="room-context-card__item">
                  {offlineSensors > 0 ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  <span>{offlineSensors > 0 ? `${offlineSensors} sensor(es) offline` : 'Telemetria consistente'}</span>
                </div>
                <div className="room-context-card__item">
                  <Bot className="h-4 w-4" />
                  <span>Automação por média da sala com contexto dos lotes</span>
                </div>
              </div>
              {roomInsight ? (
                <div className="room-context-card__insight">
                  <strong>{roomInsight.title}</strong>
                  <p>{roomInsight.copy}</p>
                  <span>{roomInsight.meta}</span>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

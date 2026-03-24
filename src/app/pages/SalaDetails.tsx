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

  return (
    <div className="room-detail-page">
      <div className="room-detail-back-row">
        <Link to="/salas" className="room-detail-back">
          <ArrowLeft className="h-4 w-4" />
          Voltar para salas
        </Link>
        <Button variant="outline" onClick={() => void loadData()}>
          Atualizar leitura
        </Button>
      </div>

      <section className={`room-detail-hero room-detail-hero--${room.status}`}>
        <div className="room-detail-hero__copy">
          <span className="rooms-kicker">Operação por sala</span>
          <h1 className="room-detail-hero__title">{room.sala.nome}</h1>
          <div className="room-detail-hero__chips">
            <span className={`room-status-chip room-status-chip--${room.status}`}>{room.statusLabel}</span>
            <span className="room-status-chip room-status-chip--ghost">{getRoomTypeLabel(room.sala.tipo)}</span>
            <span className="room-status-chip room-status-chip--ghost">{room.sala.codigo}</span>
            <span className={`room-status-chip ${room.sala.ativa !== false ? 'room-status-chip--ok' : 'room-status-chip--inactive'}`}>
              {room.sala.ativa !== false ? 'Ativa' : 'Inativa'}
            </span>
          </div>
          <p className="room-detail-hero__description">
            {room.sala.descricao || 'Sala estruturada para monitoramento ambiental, automação e operação por média consolidada.'}
          </p>
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

      <section className="room-detail-summary-grid">
        <article className="room-detail-summary-card">
          <span>Temperatura média</span>
          <strong>
            <Thermometer className="h-4 w-4" />
            {formatMetric(room.mediaTemperatura, '°C', 1)}
          </strong>
          <p>Automação e alertas calculados pela média da sala.</p>
        </article>
        <article className="room-detail-summary-card">
          <span>Umidade média</span>
          <strong>
            <Droplets className="h-4 w-4" />
            {formatMetric(room.mediaUmidade, '%', 0)}
          </strong>
          <p>Faixa comum usada para regras de climatização e nebulização.</p>
        </article>
        <article className="room-detail-summary-card">
          <span>CO2 médio</span>
          <strong>
            <Wind className="h-4 w-4" />
            {formatMetric(room.mediaCo2, ' ppm', 0)}
          </strong>
          <p>Usado para ventilação e exaustão conforme a fase operacional.</p>
        </article>
        <article className="room-detail-summary-card">
          <span>Luz média</span>
          <strong>
            <Radio className="h-4 w-4" />
            {formatMetric(room.mediaLuminosidade, ' lux', 0)}
          </strong>
          <p>Metas de iluminação seguem a referência da sala e o contexto dos lotes ativos.</p>
        </article>
        <article className="room-detail-summary-card">
          <span>Desvio entre sensores</span>
          <strong>
            <Radio className="h-4 w-4" />
            {room.divergence.temperatura.toFixed(1)}°C / {room.divergence.umidade.toFixed(0)}%
          </strong>
          <p>Divergência alta gera alerta e reduz confiança da automação.</p>
        </article>
      </section>

      <div className="room-detail-layout">
        <div className="room-detail-main">
          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Alertas</span>
                <h2 className="room-detail-section__title">Alertas da sala</h2>
              </div>
            </header>
            {room.alerts.length === 0 ? (
              <div className="room-detail-empty">Nenhum alerta ativo nesta sala.</div>
            ) : (
              <div className="room-alert-list">
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

          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Metas da sala</span>
                <h2 className="room-detail-section__title">Alvos ambientais</h2>
              </div>
            </header>

            <div className="room-context-card">
              <div className="room-context-card__item">
                <Thermometer className="h-4 w-4" />
                <span>{room.targets.temperatura.min}°C a {room.targets.temperatura.max}°C</span>
              </div>
              <div className="room-context-card__item">
                <Droplets className="h-4 w-4" />
                <span>{room.targets.umidade.min}% a {room.targets.umidade.max}%</span>
              </div>
              <div className="room-context-card__item">
                <Wind className="h-4 w-4" />
                <span>CO2 abaixo de {room.targets.co2.idealMax} ppm</span>
              </div>
              <div className="room-context-card__item">
                <Radio className="h-4 w-4" />
                <span>
                  {room.targets.luminosidade.min !== null || room.targets.luminosidade.max !== null
                    ? `${room.targets.luminosidade.min ?? 0}-${room.targets.luminosidade.max ?? 0} lux`
                    : 'Sem alvo de luz configurado'}
                </span>
              </div>
            </div>
          </section>

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
                <h2 className="room-detail-section__title">Lotes da sala</h2>
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

          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Histórico</span>
                <h2 className="room-detail-section__title">Gráficos ambientais</h2>
              </div>
            </header>

            {chartData.length === 0 ? (
              <div className="room-detail-empty">Sem histórico suficiente para renderizar gráficos desta sala.</div>
            ) : (
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
            )}
          </section>
        </div>

        <aside className="room-detail-aside">
          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Telemetria</span>
                <h2 className="room-detail-section__title">Sensores da sala</h2>
              </div>
            </header>

            {room.sensores.length === 0 ? (
              <div className="room-detail-empty">Nenhum sensor vinculado ainda.</div>
            ) : (
              <div className="room-sensor-list">
                {room.sensores.map((sensor) => (
                  <article key={sensor.key} className={`room-sensor-card ${sensor.online ? '' : 'room-sensor-card--offline'}`}>
                    <div className="room-sensor-card__head">
                      <div>
                        <strong>{sensor.label}</strong>
                        <p>{sensor.sourceLabel}</p>
                      </div>
                      <span className={`room-status-chip ${sensor.online ? 'room-status-chip--ok' : 'room-status-chip--critical'}`}>
                        {sensor.online ? 'Online' : 'Offline'}
                      </span>
                    </div>

                    <div className="room-sensor-card__metrics">
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
                <h2 className="room-detail-section__title">Atuadores da sala</h2>
              </div>
            </header>

            {room.atuadores.length === 0 ? (
              <div className="room-detail-empty">Nenhum atuador vinculado à sala.</div>
            ) : (
              <div className="room-actuator-list">
                {room.atuadores.map((atuador) => (
                  <article key={atuador.id} className="room-actuator-card">
                    <div className="room-actuator-card__head">
                      <div className="room-actuator-card__title-row">
                        <Cpu className="h-4 w-4" />
                        <strong>{atuador.nome}</strong>
                      </div>
                      <span className={`room-status-chip ${normalizeText(atuador.status) === 'online' ? 'room-status-chip--ok' : 'room-status-chip--ghost'}`}>
                        {atuador.status || 'sem status'}
                      </span>
                    </div>
                    <div className="room-actuator-card__meta">
                      <span>Tipo: {atuador.tipo || 'não informado'}</span>
                      <span>Modo: {atuador.modo_padrao || 'remote'}</span>
                      <span>Local: {atuador.localizacao || 'não informado'}</span>
                      <span>Relays: {Object.keys(atuador.relay_map || {}).length}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="room-detail-section">
            <header className="room-detail-section__header">
              <div>
                <span className="rooms-section__kicker">Resumo</span>
                <h2 className="room-detail-section__title">Estado operacional</h2>
              </div>
            </header>

            <div className="room-context-card">
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
                <Boxes className="h-4 w-4" />
                <span>{room.lotContext.primaryPhase || 'Sem fase dominante'} • {room.lotContext.highlightedLotCode || 'sem lote destaque'}</span>
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
          </section>
        </aside>
      </div>
    </div>
  );
}

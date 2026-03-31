import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { metricsService } from '../services/api';
import { DashboardMetrics, RecentSale } from '../types';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const timeAgo = (date: string): string => {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  return new Date(date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};

const CATEGORY_COLORS: Record<string, { pill: string; text: string }> = {
  'Eletrônicos':   { pill: 'rgba(96,165,250,0.15)',  text: '#93c5fd' },
  'Periféricos':   { pill: 'rgba(167,139,250,0.15)', text: '#c4b5fd' },
  'Hardware':      { pill: 'rgba(45,212,191,0.15)',  text: '#5eead4' },
  'Áudio':         { pill: 'rgba(251,191,36,0.15)',  text: '#fcd34d' },
  'Armazenamento': { pill: 'rgba(248,113,113,0.15)', text: '#fca5a5' },
  'Móveis':        { pill: 'rgba(74,222,128,0.15)',  text: '#86efac' },
};

const getCategoryStyle = (cat: string) =>
  CATEGORY_COLORS[cat] || { pill: 'rgba(255,255,255,0.1)', text: 'rgba(255,255,255,0.6)' };

const Dashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'1h' | '24h' | '7d' | '30d'>('7d');

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const data = await metricsService.getDashboard();
      setMetrics(data);
      const salesData = await metricsService.getRecentSales(10);
      setRecentSales(salesData.sales || []);
      setError('');
    } catch (err: any) {
      setError('Erro ao carregar métricas');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    socket.on('connect', () => console.log('🔌 Conectado ao WebSocket'));

    socket.on('new-sale', (sale: RecentSale) => {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 1500);
      setRecentSales((prev) => [sale, ...prev].slice(0, 10));
      setMetrics((prev) => {
        if (!prev) return prev;
        const newTotalSales = parseFloat(prev.today.totalSales) + sale.totalValue;
        const newTotalOrders = prev.today.totalOrders + 1;
        return {
          ...prev,
          today: {
            totalSales: newTotalSales.toFixed(2),
            totalOrders: newTotalOrders,
            averageTicket: (newTotalSales / newTotalOrders).toFixed(2),
          },
          salesLast7Days: [...prev.salesLast7Days, { date: sale.createdAt, value: sale.totalValue, product: sale.productName, category: sale.category }],
          salesLast30Days: [...prev.salesLast30Days, { date: sale.createdAt, value: sale.totalValue, product: sale.productName, category: sale.category }],
        };
      });
    });

    // FIX: atualiza só o contador, sem sobrescrever o estado inteiro
    socket.on('user-activity', (data: { action: string; sessionId: string }) => {
      setMetrics((prev) => {
        if (!prev) return prev;
        const delta = data.action === 'joined' ? 1 : -1;
        return { ...prev, activeUsers: Math.max(0, prev.activeUsers + delta) };
      });
    });

    return () => {
      socket.off('connect');
      socket.off('new-sale');
      socket.off('user-activity');
    };
  }, []);

  const filteredSalesChartData = React.useMemo(() => {
    if (!metrics) return [];
    const offsets: Record<string, number> = {
      '1h': 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const startDate = new Date(Date.now() - offsets[timeFilter]);
    const salesData = timeFilter === '30d' ? metrics.salesLast30Days : metrics.salesLast7Days;
    const filtered = salesData.filter((s) => new Date(s.date) >= startDate);
    if (filtered.length === 0) return [];
    const grouped = filtered.reduce((acc: any, sale) => {
      const key =
        timeFilter === '1h' || timeFilter === '24h'
          ? new Date(sale.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : new Date(sale.date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      acc[key] = (acc[key] || 0) + sale.value;
      return acc;
    }, {});
    return Object.entries(grouped).map(([date, valor]) => ({
      date,
      valor: parseFloat(Number(valor).toFixed(2)),
    }));
  }, [metrics, timeFilter]);

  const categoryData = React.useMemo(() => {
    return (
      metrics?.topProducts.reduce((acc: any[], p) => {
        const ex = acc.find((i) => i.category === p.category);
        if (ex) ex.quantidade += 1;
        else acc.push({ category: p.category, quantidade: 1 });
        return acc;
      }, []) || []
    );
  }, [metrics?.topProducts]);

  const handleLogout = () => { logout(); navigate('/'); };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div style={s.tooltip}>
        <p style={s.tooltipLabel}>{label}</p>
        <p style={s.tooltipVal}>R$ {formatCurrency(payload[0].value)}</p>
      </div>
    );
  };

  if (loading && !metrics) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.spinner} />
        <p style={s.loadingText}>Carregando dashboard...</p>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div style={s.loadingWrap}>
        <div style={s.errorBox}>{error}</div>
      </div>
    );
  }

  const metricCards = [
    {
      label: 'Vendas hoje',
      value: `R$ ${formatCurrency(parseFloat(metrics?.today.totalSales || '0'))}`,
      sub: `${metrics?.today.totalOrders} pedidos`,
      color: '#4ade80',
      glow: 'rgba(74,222,128,0.08)',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      label: 'Ticket médio',
      value: `R$ ${formatCurrency(parseFloat(metrics?.today.averageTicket || '0'))}`,
      sub: 'por pedido',
      color: '#a78bfa',
      glow: 'rgba(167,139,250,0.08)',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
    },
    {
      label: 'Usuários ativos',
      value: String(metrics?.activeUsers ?? 0),
      sub: 'online agora',
      color: '#60a5fa',
      glow: 'rgba(96,165,250,0.08)',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      label: 'Conversão',
      value: String(metrics?.conversionRate ?? '—'),
      sub: 'taxa de conversão',
      color: '#fbbf24',
      glow: 'rgba(251,191,36,0.08)',
      icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    },
  ];

  const filters: Array<'1h' | '24h' | '7d' | '30d'> = ['1h', '24h', '7d', '30d'];

  return (
    <div style={s.root}>
      <div style={s.orb1} />
      <div style={s.orb2} />
      <div style={s.orb3} />

      <div style={s.inner}>
        {/* Navbar */}
        <nav style={s.nav}>
          <div style={s.navLeft}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="#a78bfa"/>
              <rect x="13" y="3" width="8" height="8" rx="2" fill="#60a5fa"/>
              <rect x="3" y="13" width="8" height="8" rx="2" fill="#34d399"/>
              <rect x="13" y="13" width="8" height="8" rx="2" fill="#f472b6"/>
            </svg>
            <span style={s.navTitle}>Analytics</span>
            {isUpdating && (
              <div style={s.liveChip}>
                <span style={s.liveDot} />
                ao vivo
              </div>
            )}
          </div>
          <div style={s.navRight}>
            <span style={s.navUser}>Olá, {user?.name}</span>
            <button style={s.logoutBtn} onClick={handleLogout}>Sair</button>
          </div>
        </nav>

        {/* Metric cards */}
        <div style={s.cardGrid}>
          {metricCards.map((card, i) => (
            <div key={i} style={{ ...s.metricCard, background: `linear-gradient(135deg, rgba(255,255,255,0.05), ${card.glow})` }}>
              <div style={s.metricTop}>
                <span style={s.metricLabel}>{card.label}</span>
                <div style={{ ...s.metricIcon, background: card.glow }}>{card.icon}</div>
              </div>
              <div style={{ ...s.metricValue, color: card.color }}>{card.value}</div>
              <div style={s.metricSub}>{card.sub}</div>
            </div>
          ))}
        </div>

        {/* Charts row */}
        <div style={s.chartsRow}>
          <div style={s.glassPanel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>Vendas por período</span>
              <div style={s.filterGroup}>
                {filters.map((f) => (
                  <button
                    key={f}
                    style={{ ...s.filterBtn, ...(timeFilter === f ? s.filterBtnActive : {}) }}
                    onClick={() => setTimeFilter(f)}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={filteredSalesChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="lineGradFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="valor" stroke="#a78bfa" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#a78bfa', strokeWidth: 0 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Feed */}
          <div style={s.glassPanel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>Tempo real</span>
              <div style={s.liveChip}><span style={s.liveDot} />ao vivo</div>
            </div>
            <div style={s.feedList} className="feed-scroll">
              {recentSales.length === 0 ? (
                <p style={s.emptyFeed}>Aguardando vendas...</p>
              ) : (
                recentSales.map((sale) => {
                  const cs = getCategoryStyle(sale.category);
                  return (
                    <div key={sale.id} style={s.feedItem}>
                      <div>
                        <div style={s.feedName}>{sale.productName}</div>
                        <span style={{ ...s.pill, background: cs.pill, color: cs.text, marginTop: 4, display: 'inline-block' }}>
                          {sale.category}
                        </span>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={s.feedValue}>R$ {formatCurrency(sale.totalValue)}</div>
                        <div style={s.feedTime}>{timeAgo(sale.createdAt)}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Second row */}
        <div style={s.chartsRow}>
          <div style={s.glassPanel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>Produtos por categoria</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={categoryData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="category" stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                <YAxis stroke="rgba(255,255,255,0.15)" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: 'rgba(10,8,20,0.95)', border: '0.5px solid rgba(255,255,255,0.12)', borderRadius: 10, color: '#fff', fontSize: 12 }}
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                />
                <Bar dataKey="quantidade" name="Qtd" radius={[6, 6, 0, 0]} fill="url(#barGrad)" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Top products */}
          <div style={s.glassPanel}>
            <div style={s.panelHeader}>
              <span style={s.panelTitle}>Top produtos</span>
            </div>
            <div style={s.feedList} className="feed-scroll">
              {metrics?.topProducts.slice(0, 6).map((product, i) => {
                const cs = getCategoryStyle(product.category);
                return (
                  <div key={i} style={s.feedItem}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={s.rankNum}>{i + 1}</span>
                      <div>
                        <div style={s.feedName}>{product.name}</div>
                        <span style={{ ...s.pill, background: cs.pill, color: cs.text, marginTop: 4, display: 'inline-block' }}>
                          {product.category}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { background: #0a0814 !important; margin: 0; }
        @keyframes pulse-dot {
          0%,100% { opacity:1; box-shadow:0 0 6px #4ade80; }
          50% { opacity:0.4; box-shadow:0 0 2px #4ade80; }
        }
        @keyframes float1 {
          0%,100% { transform:translate(0,0) scale(1); }
          50% { transform:translate(30px,-20px) scale(1.05); }
        }
        @keyframes float2 {
          0%,100% { transform:translate(0,0) scale(1); }
          50% { transform:translate(-20px,30px) scale(1.08); }
        }
        @keyframes float3 {
          0%,100% { transform:translate(0,0) scale(1); }
          50% { transform:translate(15px,15px) scale(1.03); }
        }
        @keyframes fadeSlideIn {
          from { opacity:0; transform:translateY(8px); }
          to { opacity:1; transform:translateY(0); }
        }
        @keyframes spin {
          to { transform:rotate(360deg); }
        }
        .feed-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0814 0%, #0f0c29 40%, #1a0f2e 100%)',
    fontFamily: "'DM Sans', sans-serif",
    position: 'relative',
    overflowX: 'hidden',
  },
  orb1: {
    position: 'absolute', top: -120, left: -120,
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(167,139,250,0.18) 0%, transparent 70%)',
    animation: 'float1 12s ease-in-out infinite',
    pointerEvents: 'none',
  },
  orb2: {
    position: 'absolute', top: 200, right: -100,
    width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(96,165,250,0.14) 0%, transparent 70%)',
    animation: 'float2 15s ease-in-out infinite',
    pointerEvents: 'none',
  },
  orb3: {
    position: 'absolute', bottom: 100, left: '40%',
    width: 350, height: 350, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 70%)',
    animation: 'float3 18s ease-in-out infinite',
    pointerEvents: 'none',
  },
  inner: {
    position: 'relative', zIndex: 1,
    maxWidth: 1280, margin: '0 auto',
    padding: '0 24px 48px',
  },
  nav: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 0 28px',
    borderBottom: '0.5px solid rgba(255,255,255,0.06)',
    marginBottom: 28,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 12 },
  navTitle: { fontSize: 16, fontWeight: 600, color: '#fff', letterSpacing: '-0.01em' },
  navRight: { display: 'flex', alignItems: 'center', gap: 14 },
  navUser: { fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  logoutBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '0.5px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '6px 14px',
    color: 'rgba(255,255,255,0.5)', fontSize: 12,
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  },
  liveChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'rgba(74,222,128,0.08)',
    border: '0.5px solid rgba(74,222,128,0.2)',
    borderRadius: 20, padding: '4px 10px',
    fontSize: 11, color: '#4ade80', fontWeight: 500,
  },
  liveDot: {
    display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
    background: '#4ade80', animation: 'pulse-dot 2s infinite',
  },
  cardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
    gap: 12, marginBottom: 12,
  },
  metricCard: {
    borderRadius: 14, border: '0.5px solid rgba(255,255,255,0.09)',
    padding: '18px 20px',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
    animation: 'fadeSlideIn 0.4s ease both',
  },
  metricTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  metricLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.07em', textTransform: 'uppercase' },
  metricIcon: { width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontSize: 24, fontWeight: 600, lineHeight: 1, marginBottom: 6, letterSpacing: '-0.02em' },
  metricSub: { fontSize: 12, color: 'rgba(255,255,255,0.25)' },
  chartsRow: { display: 'grid', gridTemplateColumns: '1fr 340px', gap: 12, marginBottom: 12 },
  glassPanel: {
    background: 'rgba(255,255,255,0.03)',
    border: '0.5px solid rgba(255,255,255,0.08)',
    borderRadius: 14, padding: '20px 22px',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
  },
  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  panelTitle: { fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.07em', textTransform: 'uppercase' },
  filterGroup: { display: 'flex', gap: 4 },
  filterBtn: {
    background: 'transparent', border: '0.5px solid rgba(255,255,255,0.08)',
    borderRadius: 6, padding: '4px 10px',
    color: 'rgba(255,255,255,0.3)', fontSize: 11,
    cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
  },
  filterBtnActive: {
    background: 'rgba(167,139,250,0.12)',
    border: '0.5px solid rgba(167,139,250,0.3)',
    color: '#c4b5fd',
  },
  feedList: { display: 'flex', flexDirection: 'column', gap: 0, overflowY: 'auto', maxHeight: 260, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties,
  feedItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '0.5px solid rgba(255,255,255,0.05)',
    animation: 'fadeSlideIn 0.3s ease both',
  },
  feedName: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500 },
  feedValue: { fontSize: 13, fontWeight: 600, color: '#4ade80' },
  feedTime: { fontSize: 11, color: 'rgba(255,255,255,0.22)', marginTop: 3 },
  pill: { fontSize: 10, fontWeight: 500, padding: '3px 8px', borderRadius: 20 },
  rankNum: {
    width: 22, height: 22, borderRadius: 6,
    background: 'rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, flexShrink: 0,
  },
  emptyFeed: { fontSize: 13, color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: '32px 0' },
  tooltip: {
    background: 'rgba(10,8,20,0.95)',
    border: '0.5px solid rgba(255,255,255,0.12)',
    borderRadius: 10, padding: '8px 12px',
  },
  tooltipLabel: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4 },
  tooltipVal: { fontSize: 14, fontWeight: 600, color: '#a78bfa' },
  loadingWrap: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0814 0%, #0f0c29 100%)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', gap: 16,
  },
  spinner: {
    width: 36, height: 36, borderRadius: '50%',
    border: '2px solid rgba(167,139,250,0.15)',
    borderTopColor: '#a78bfa',
    animation: 'spin 0.8s linear infinite',
  },
  loadingText: { fontSize: 13, color: 'rgba(255,255,255,0.25)' },
  errorBox: {
    background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.25)',
    borderRadius: 12, padding: '12px 20px', color: '#fca5a5', fontSize: 13,
  },
};

export default Dashboard;
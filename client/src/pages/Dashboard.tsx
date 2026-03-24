import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { metricsService } from '../services/api';
import { DashboardMetrics, RecentSale } from '../types';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

const formatCurrency = (value: number): string => {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

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
      
      // Buscar vendas recentes também
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

    // Conectar ao WebSocket
    socket.on('connect', () => {
      console.log('🔌 Conectado ao WebSocket');
    });

    // Receber nova venda em tempo real
    socket.on('new-sale', (sale: RecentSale) => {
      console.log('💰 Nova venda recebida:', sale);
      
      // Mostrar indicador de atualização
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 1000);

      // Adicionar venda na lista
      setRecentSales((prev) => [sale, ...prev].slice(0, 10));

      // Atualizar métricas localmente (TEMPO REAL)
      setMetrics((prevMetrics) => {
        if (!prevMetrics) return prevMetrics;
        
        const newTotalSales = parseFloat(prevMetrics.today.totalSales) + sale.totalValue;
        const newTotalOrders = prevMetrics.today.totalOrders + 1;
        const newAverageTicket = (newTotalSales / newTotalOrders).toFixed(2);

        return {
          ...prevMetrics,
          today: {
            totalSales: newTotalSales.toFixed(2),
            totalOrders: newTotalOrders,
            averageTicket: newAverageTicket,
          },
          // Adicionar venda aos gráficos também
          salesLast7Days: [...prevMetrics.salesLast7Days, {
            date: sale.createdAt,
            value: sale.totalValue,
            product: sale.productName,
            category: sale.category,
          }],
          salesLast30Days: [...prevMetrics.salesLast30Days, {
            date: sale.createdAt,
            value: sale.totalValue,
            product: sale.productName,
            category: sale.category,
          }],
        };
      });
    });

    socket.on('user-activity', () => {
      // Atualizar contagem de usuários
      fetchMetrics();
    });

    return () => {
      socket.off('connect');
      socket.off('new-sale');
      socket.off('user-activity');
    };
  }, []);

const filteredSalesChartData = React.useMemo(() => {
  if (!metrics) return [];
  
  const now = new Date();
  let startDate: Date;
  
  switch (timeFilter) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  }
  
  const salesData = timeFilter === '30d' ? metrics.salesLast30Days : metrics.salesLast7Days;
  const filteredSales = salesData.filter(sale => new Date(sale.date) >= startDate);
  
  if (filteredSales.length === 0) return [];
  
  const groupedByDate = filteredSales.reduce((acc: any, sale) => {
    let dateKey: string;
    
    if (timeFilter === '1h' || timeFilter === '24h') {
      dateKey = new Date(sale.date).toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      dateKey = new Date(sale.date).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit' 
      });
    }
    
    if (acc[dateKey]) {
      acc[dateKey] += sale.value;
    } else {
      acc[dateKey] = sale.value;
    }
    
    return acc;
  }, {});
  
  return Object.entries(groupedByDate).map(([date, valor]) => ({
    date,
    valor: parseFloat(Number(valor).toFixed(2)),
  }));
}, [metrics, timeFilter]);

  const categoryData = React.useMemo(() => {
    return metrics?.topProducts.reduce((acc: any[], product) => {
      const existing = acc.find((item) => item.category === product.category);
      if (existing) {
        existing.quantidade += 1;
      } else {
        acc.push({ category: product.category, quantidade: 1 });
      }
      return acc;
    }, []) || [];
  }, [metrics?.topProducts]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading && !metrics) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
          <span className="visually-hidden">Carregando...</span>
        </div>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div className="container mt-5">
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-vh-100" style={{ backgroundColor: '#f0f2f5' }}>
      {/* Navbar */}
      <nav className="navbar navbar-dark shadow-sm" style={{ backgroundColor: '#1a73e8' }}>
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            📊 Dashboard Analytics
            {isUpdating && (
              <span className="badge bg-success ms-2 animate-pulse">
                🔴 AO VIVO
              </span>
            )}
          </span>
          <div className="d-flex align-items-center">
            <span className="text-white me-3">👋 Olá, {user?.name}!</span>
            <button className="btn btn-outline-light btn-sm" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </div>
      </nav>

      <div className="container-fluid p-4">
        {/* Cards de Métricas */}
        <div className="row g-4 mb-4">
          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100 hover-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="text-muted mb-0">💰 Vendas Hoje</h6>
                  <div className="bg-success bg-opacity-10 rounded-circle p-2">
                    <span className="text-success">📈</span>
                  </div>
                </div>
                <h2 className="text-success fw-bold mb-1">
                  R$ {formatCurrency(parseFloat(metrics?.today.totalSales || '0'))}
                </h2>
                <p className="text-muted mb-0 small">
                  <strong>{metrics?.today.totalOrders}</strong> pedidos realizados
                </p>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100 hover-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="text-muted mb-0">🎯 Ticket Médio</h6>
                  <div className="bg-primary bg-opacity-10 rounded-circle p-2">
                    <span className="text-primary">💵</span>
                  </div>
                </div>
                <h2 className="text-primary fw-bold mb-1">
                  R$ {formatCurrency(parseFloat(metrics?.today.averageTicket || '0'))}
                </h2>
                <p className="text-muted mb-0 small">por pedido</p>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100 hover-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="text-muted mb-0">👥 Usuários Ativos</h6>
                  <div className="bg-info bg-opacity-10 rounded-circle p-2">
                    <span className="text-info">🌐</span>
                  </div>
                </div>
                <h2 className="text-info fw-bold mb-1">{metrics?.activeUsers}</h2>
                <p className="text-muted mb-0 small">
                  <span className="text-success">● </span>online agora
                </p>
              </div>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="card shadow-sm border-0 h-100 hover-card">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="text-muted mb-0">📈 Conversão</h6>
                  <div className="bg-warning bg-opacity-10 rounded-circle p-2">
                    <span className="text-warning">⚡</span>
                  </div>
                </div>
                <h2 className="text-warning fw-bold mb-1">{metrics?.conversionRate}</h2>
                <p className="text-muted mb-0 small">taxa de conversão</p>
              </div>
            </div>
          </div>
        </div>

        {/* Gráficos e Feed */}
        <div className="row g-4">
          {/* Gráfico de Vendas com Filtros */}
          <div className="col-lg-8">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body">
                <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
                  <h5 className="card-title fw-bold mb-0">📊 Vendas por Período</h5>
                  <div className="btn-group btn-group-sm" role="group">
                    <button
                      type="button"
                      className={`btn ${timeFilter === '1h' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeFilter('1h')}
                    >
                      1 Hora
                    </button>
                    <button
                      type="button"
                      className={`btn ${timeFilter === '24h' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeFilter('24h')}
                    >
                      24 Horas
                    </button>
                    <button
                      type="button"
                      className={`btn ${timeFilter === '7d' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeFilter('7d')}
                    >
                      7 Dias
                    </button>
                    <button
                      type="button"
                      className={`btn ${timeFilter === '30d' ? 'btn-primary' : 'btn-outline-primary'}`}
                      onClick={() => setTimeFilter('30d')}
                    >
                      30 Dias
                    </button>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={filteredSalesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="date" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                      }}
                      formatter={(value: any) => `R$ ${formatCurrency(Number(value))}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="#1a73e8"
                      strokeWidth={3}
                      name="Valor (R$)"
                      dot={{ fill: '#1a73e8', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Feed de Vendas em Tempo Real */}
          <div className="col-lg-4">
            <div className="card shadow-sm border-0 h-100">
              <div className="card-body">
                <h5 className="card-title fw-bold mb-4">
                  🔴 Vendas em Tempo Real
                </h5>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {recentSales.length === 0 ? (
                    <p className="text-muted text-center py-4">
                      Aguardando vendas...
                    </p>
                  ) : (
                    recentSales.map((sale) => (
                      <div
                        key={sale.id}
                        className="alert alert-light border-start border-success border-4 mb-2 fade-in"
                      >
                        <div className="d-flex justify-content-between align-items-start">
                          <div>
                            <strong className="text-dark">{sale.productName}</strong>
                            <br />
                            <small className="text-muted">
                              {sale.amount}x R$ {formatCurrency(sale.price)}
                            </small>
                          </div>
                          <div className="text-end">
                            <strong className="text-success">
                              R$ {formatCurrency(sale.totalValue)}
                            </strong>
                            <br />
                            <small className="text-muted">
                              {new Date(sale.createdAt).toLocaleTimeString('pt-BR')}
                            </small>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Segunda Linha de Gráficos */}
        <div className="row g-4 mt-2">
          {/* Gráfico de Categorias */}
          <div className="col-lg-6">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title fw-bold mb-4">🏷️ Produtos por Categoria</h5>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="category" stroke="#666" />
                    <YAxis stroke="#666" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#fff',
                        border: '1px solid #ddd',
                        borderRadius: '8px',
                      }}
                    />
                    <Bar dataKey="quantidade" fill="#198754" name="Quantidade" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Produtos */}
          <div className="col-lg-6">
            <div className="card shadow-sm border-0">
              <div className="card-body">
                <h5 className="card-title fw-bold mb-4">🔥 Top Produtos</h5>
                <div className="table-responsive">
                  <table className="table table-hover">
                    <thead>
                      <tr>
                        <th className="border-0">Produto</th>
                        <th className="border-0">Categoria</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics?.topProducts.slice(0, 5).map((product, index) => (
                        <tr key={index}>
                          <td>
                            <span className="fw-semibold">{product.name}</span>
                          </td>
                          <td>
                            <span className="badge bg-secondary">{product.category}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Inline para Animações */}
      <style>{`
        .hover-card {
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .hover-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 8px 20px rgba(0,0,0,0.12) !important;
        }
        .fade-in {
          animation: fadeIn 0.5s ease-in;
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-pulse {
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
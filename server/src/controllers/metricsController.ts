import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Sale, ActiveUser } from '../models';
import { Op } from 'sequelize';

export const getDashboardMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    // Total de vendas hoje
    const salesToday = await Sale.findAll({
      where: {
        createdAt: {
          [Op.gte]: today,
        },
      },
    });

    const totalSalesToday = salesToday.reduce((sum, sale) => sum + Number(sale.totalValue), 0);
    const totalOrdersToday = salesToday.length;

    // Vendas últimos 7 dias
    const salesLast7Days = await Sale.findAll({
      where: {
        createdAt: {
          [Op.gte]: last7Days,
        },
      },
      order: [['createdAt', 'ASC']],
    });

    // Vendas últimos 30 dias
    const salesLast30Days = await Sale.findAll({
      where: {
        createdAt: {
          [Op.gte]: last30Days,
        },
      },
      order: [['createdAt', 'ASC']],
    });

    // Usuários ativos (últimos 5 minutos)
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const activeUsersCount = await ActiveUser.count({
      where: {
        updatedAt: {
          [Op.gte]: fiveMinutesAgo,
        },
      },
    });

    // Produtos mais vendidos
    const topProducts = await Sale.findAll({
      attributes: ['productName', 'category'],
      where: {
        createdAt: {
          [Op.gte]: last7Days,
        },
      },
      limit: 5,
    });

    // Taxa de conversão simulada
    const conversionRate = (totalOrdersToday / Math.max(activeUsersCount * 10, 1) * 100).toFixed(2);

    res.json({
      today: {
        totalSales: totalSalesToday.toFixed(2),
        totalOrders: totalOrdersToday,
        averageTicket: totalOrdersToday > 0 ? (totalSalesToday / totalOrdersToday).toFixed(2) : '0.00',
      },
      activeUsers: activeUsersCount,
      conversionRate: `${conversionRate}%`,
      salesLast7Days: salesLast7Days.map(sale => ({
        date: sale.createdAt,
        value: Number(sale.totalValue),
        product: sale.productName,
        category: sale.category,
      })),
      salesLast30Days: salesLast30Days.map(sale => ({
        date: sale.createdAt,
        value: Number(sale.totalValue),
        product: sale.productName,
        category: sale.category,
      })),
      topProducts: topProducts.map(sale => ({
        name: sale.productName,
        category: sale.category,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar métricas:', error);
    res.status(500).json({ error: 'Erro ao buscar métricas' });
  }
};

export const getRecentSales = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const recentSales = await Sale.findAll({
      order: [['createdAt', 'DESC']],
      limit,
    });

    res.json({
      sales: recentSales.map(sale => ({
        id: sale.id,
        productName: sale.productName,
        amount: sale.amount,
        price: Number(sale.price),
        totalValue: Number(sale.totalValue),
        category: sale.category,
        createdAt: sale.createdAt,
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar vendas recentes:', error);
    res.status(500).json({ error: 'Erro ao buscar vendas recentes' });
  }
};
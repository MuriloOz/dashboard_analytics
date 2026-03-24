import { Sale, ActiveUser } from '../models';
import { io } from '../server';

const products = [
  { name: 'Notebook Dell', category: 'Eletrônicos', minPrice: 2500, maxPrice: 5000 },
  { name: 'Mouse Logitech', category: 'Periféricos', minPrice: 50, maxPrice: 200 },
  { name: 'Teclado Mecânico', category: 'Periféricos', minPrice: 200, maxPrice: 800 },
  { name: 'Monitor LG 27"', category: 'Eletrônicos', minPrice: 800, maxPrice: 2000 },
  { name: 'Headset Gamer', category: 'Áudio', minPrice: 150, maxPrice: 600 },
  { name: 'Webcam Logitech', category: 'Periféricos', minPrice: 200, maxPrice: 500 },
  { name: 'SSD 1TB', category: 'Armazenamento', minPrice: 300, maxPrice: 700 },
  { name: 'Memória RAM 16GB', category: 'Hardware', minPrice: 250, maxPrice: 500 },
  { name: 'Placa de Vídeo RTX', category: 'Hardware', minPrice: 2000, maxPrice: 5000 },
  { name: 'Cadeira Gamer', category: 'Móveis', minPrice: 800, maxPrice: 2500 },
];

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const randomFloat = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

export const generateSale = async (): Promise<void> => {
  try {
    const product = products[randomInt(0, products.length - 1)];
    const amount = randomInt(1, 5);
    const price = randomFloat(product.minPrice, product.maxPrice);
    const totalValue = price * amount;

    const sale = await Sale.create({
      productName: product.name,
      amount,
      price,
      totalValue,
      category: product.category,
    });

    console.log(`💰 Nova venda: ${product.name} - R$ ${totalValue.toFixed(2)}`);

    // Emitir evento WebSocket
    io.emit('new-sale', {
      id: sale.id,
      productName: sale.productName,
      amount: sale.amount,
      price: Number(sale.price),
      totalValue: Number(sale.totalValue),
      category: sale.category,
      createdAt: sale.createdAt,
    });
  } catch (error) {
    console.error('Erro ao gerar venda:', error);
  }
};

export const generateActiveUser = async (): Promise<void> => {
  try {
    const sessionId = `session_${Date.now()}_${randomInt(1000, 9999)}`;
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/17.2',
      'Mozilla/5.0 (X11; Linux x86_64) Firefox/121.0',
    ];
    const ips = [
      '192.168.1.100',
      '192.168.1.101',
      '192.168.1.102',
      '10.0.0.50',
      '10.0.0.51',
    ];

    await ActiveUser.create({
      sessionId,
      userAgent: userAgents[randomInt(0, userAgents.length - 1)],
      ipAddress: ips[randomInt(0, ips.length - 1)],
    });

    console.log(`👤 Novo usuário ativo: ${sessionId}`);

    // Emitir evento WebSocket
    io.emit('user-activity', {
      action: 'joined',
      sessionId,
    });
  } catch (error) {
    console.error('Erro ao gerar usuário ativo:', error);
  }
};

export const startDataGeneration = (): void => {
  console.log('🎲 Iniciando geração de dados simulados...');

  // Gerar uma venda a cada 5-15 segundos
  setInterval(() => {
    generateSale();
  }, randomInt(5000, 15000));

  // Gerar um usuário ativo a cada 10-30 segundos
  setInterval(() => {
    generateActiveUser();
  }, randomInt(10000, 30000));

  // Limpar usuários inativos a cada 5 minutos
  setInterval(async () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const deleted = await ActiveUser.destroy({
      where: {
        updatedAt: {
          $lt: fiveMinutesAgo,
        } as any,
      },
    });
    if (deleted > 0) {
      console.log(`🧹 Removidos ${deleted} usuários inativos`);
    }
  }, 5 * 60 * 1000);
};
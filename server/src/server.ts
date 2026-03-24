import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { syncDatabase } from './models';
import authRoutes from './routes/authRoutes';
import metricsRoutes from './routes/metricsRoutes';
import { startDataGeneration } from './utils/dataGenerator';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Criar servidor HTTP
const httpServer = createServer(app);

// Configurar Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Tornar io disponível globalmente
export { io };

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/metrics', metricsRoutes);

// Rota de teste
app.get('/', (req, res) => {
  res.json({ message: 'API Dashboard Analytics funcionando!' });
});

// WebSocket
io.on('connection', (socket) => {
  console.log('🔌 Cliente conectado:', socket.id);

  socket.on('disconnect', () => {
    console.log('❌ Cliente desconectado:', socket.id);
  });
});

// Inicializar servidor
const startServer = async () => {
  try {
    await syncDatabase();

    httpServer.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`🔌 WebSocket habilitado`);

      // Iniciar geração de dados simulados
      startDataGeneration();
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();
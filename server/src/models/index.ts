import sequelize from '../config/database';
import User from './User';
import Sale from './Sale';
import ActiveUser from './ActiveUser';

const syncDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Conexão com banco de dados estabelecida');
    
    await sequelize.sync({ alter: true });
    console.log('✅ Modelos sincronizados com o banco');
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco:', error);
    process.exit(1);
  }
};

export { sequelize, User, Sale, ActiveUser, syncDatabase };
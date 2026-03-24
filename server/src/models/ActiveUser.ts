import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ActiveUserAttributes {
  id: number;
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  createdAt: Date;  
  updatedAt: Date;
}

interface ActiveUserCreationAttributes extends Optional<ActiveUserAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class ActiveUser extends Model<ActiveUserAttributes, ActiveUserCreationAttributes> implements ActiveUserAttributes {
  declare id: number;
  declare sessionId: string;
  declare userAgent: string;
  declare ipAddress: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

ActiveUser.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    sessionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    userAgent: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'active_users',
    timestamps: true,
  }
);

export default ActiveUser;
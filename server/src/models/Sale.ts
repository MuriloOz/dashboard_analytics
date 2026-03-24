import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SaleAttributes {
  id: number;
  productName: string;
  amount: number;
  price: number;
  totalValue: number;
  category: string;
  createdAt: Date;  
  updatedAt: Date;
}

interface SaleCreationAttributes extends Optional<SaleAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
  declare id: number;
  declare productName: string;
  declare amount: number;
  declare price: number;
  declare totalValue: number;
  declare category: string;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Sale.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    productName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    totalValue: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
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
    tableName: 'sales',
    timestamps: true,
  }
);

export default Sale;
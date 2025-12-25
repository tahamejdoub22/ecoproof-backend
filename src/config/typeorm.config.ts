import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';

config();

const configService = new ConfigService();

export const typeOrmConfig: DataSourceOptions = {
  type: 'postgres',
  url: configService.get('DATABASE_URL'),
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false, // Never true in production
  logging: configService.get('NODE_ENV') === 'development',
  ssl: {
    rejectUnauthorized: false,
  },
  extra: {
    max: 10, // Connection pool max
    min: 2, // Connection pool min
  },
};

export default new DataSource(typeOrmConfig);

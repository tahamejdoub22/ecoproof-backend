import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';

// Load env vars if not already loaded (e.g. by NestJS ConfigModule)
// We use process.env directly here because ConfigModule might not be initialized
// when running migrations via CLI
if (!process.env.DATABASE_URL) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();
}

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

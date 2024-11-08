import type { ILogger } from '@runtipi/shared/node';
import { type NodePgDatabase, drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export type IDatabase = NodePgDatabase<typeof schema>;

type IConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
};

export interface IDbClient {
  db: IDatabase;
}

export class DbClient {
  public db: IDatabase;
  private logger: ILogger;

  constructor(config: IConfig, logger: ILogger) {
    this.logger = logger;
    const connectionString = `postgresql://${config.username}:${config.password}@${config.host}:${config.port}/${config.database}?connect_timeout=300`;

    const pool = new Pool({
      connectionString,
    });

    pool.on('error', async (err) => {
      this.logger.error('Unexpected error on idle client:', err);
    });

    pool.on('connect', () => {
      this.logger.debug('Connected to the database successfully.');
    });

    pool.on('remove', () => {
      this.logger.debug('Client removed from the pool.');
    });

    this.db = drizzle(pool, { schema });
  }
}

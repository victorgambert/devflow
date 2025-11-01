/**
 * Configuration utilities
 */

export interface AppConfig {
  port: number;
  database: {
    url: string;
  };
  temporal: {
    address: string;
  };
  redis: {
    host: string;
    port: number;
  };
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    database: {
      url: process.env.DATABASE_URL || 'postgresql://localhost:5432/devflow',
    },
    temporal: {
      address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
    },
  };
}


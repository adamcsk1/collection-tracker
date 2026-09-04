import dotenv from 'dotenv';
import fastify from 'fastify';
import { existsSync } from 'fs';
import { registerAllApis } from '../apis';
import { getArgv } from './argv';
import { getExternalMetadataConfig } from './external-metadata-config';
import { errorLog, infoLog } from './logger';

const DEFAULT_PORT = 3002;

export const main = async (): Promise<void> => {
  try {
    const { dataFolder } = getArgv();
    const envPath = `${dataFolder}/.env`;
    if (existsSync(envPath)) dotenv.config({ path: envPath, override: true });
    getExternalMetadataConfig();

    const app = fastify({ logger: false });
    registerAllApis(app);

    const port = Number(process.env.METADATA_PROVIDER_PORT || DEFAULT_PORT);
    const host = process.env.HOST || '127.0.0.1';
    await app.listen({ port, host });
    await infoLog(`[ ready ] http://${host}:${port}`);
  } catch (error: unknown) {
    if (error instanceof Error) await errorLog(`Metadata provider start error (${error.message})`);
    process.exit(1);
  }
};

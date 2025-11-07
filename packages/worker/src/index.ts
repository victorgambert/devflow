/**
 * Temporal Worker Entry Point
 */

import { Worker, NativeConnection } from '@temporalio/worker';
import * as activities from './activities';
import { createLogger } from '@soma-squad-ai/common';
import * as dotenv from 'dotenv';

dotenv.config();

const logger = createLogger('Worker');

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  const worker = await Worker.create({
    connection,
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: process.env.TEMPORAL_TASK_QUEUE || 'devflow',
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  logger.info('Temporal worker started', {
    namespace: process.env.TEMPORAL_NAMESPACE,
    taskQueue: process.env.TEMPORAL_TASK_QUEUE,
  });

  await worker.run();
}

run().catch((err) => {
  logger.error('Worker failed', err);
  process.exit(1);
});


import { createApp } from './app.js';
import { config } from './config.js';
import { auditLog } from './shared/utils/audit-logger.js';
import { startTrashScheduler } from './services/trash-scheduler.js';

const app = createApp();

app.listen(config.PORT, () => {
  console.log(`FlowTask API running on port ${config.PORT} [${config.NODE_ENV}]`);
  void auditLog({
    actorId: 'system',
    action: 'system.service.start',
    result: 'SUCCESS',
    meta: { port: config.PORT, env: config.NODE_ENV },
  });
  startTrashScheduler();
});

import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry.js';

// Route files register their paths as a side effect on import.
import './routes/auth.js';
import './routes/workspaces.js';
import './routes/boards.js';
import './routes/tasks.js';
import './routes/labels.js';
import './routes/comments.js';
import './routes/search.js';
import './routes/notifications.js';
import './routes/admin.js';

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'FlowTask API',
      version: process.env.npm_package_version ?? '1.0.0',
      description: 'REST API таск-трекера FlowTask. Kanban-доски, задачи, RBAC, SSO.',
    },
    servers: [{ url: '/api', description: 'API' }],
  });
}

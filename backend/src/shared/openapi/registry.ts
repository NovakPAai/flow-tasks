import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

// Singleton registry — imported by all route registration files.
// Do NOT import route files here (circular dep). Import in index.ts instead.
export const registry = new OpenAPIRegistry();

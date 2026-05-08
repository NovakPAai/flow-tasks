import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Must be called once before any schema is used in registerPath/register.
extendZodWithOpenApi(z);

// Singleton registry — imported by all route registration files.
// Do NOT import route files here (circular dep). Import in index.ts instead.
export const registry = new OpenAPIRegistry();

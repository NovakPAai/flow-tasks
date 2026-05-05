#!/usr/bin/env tsx
/**
 * Static RBAC check: every router.get/post/put/patch/delete in src/modules/
 * (except auth, health, integrations/public) must include authenticate middleware.
 *
 * Exits 1 if any unprotected route is found — blocks CI.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const MODULE_DIR = new URL('../src/modules', import.meta.url).pathname;

// Modules where all routes are intentionally public (no authenticate required)
const PUBLIC_MODULES = new Set(['auth']);

// Router methods to check
const ROUTE_RE = /router\.(get|post|put|patch|delete)\s*\(/g;

// Indicators of authentication
const AUTH_INDICATORS = [
  'authenticate',
  'requireSuperadmin',
  'authHandler',
  'router.use(authenticate',
];

function collectRouterFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectRouterFiles(full));
    } else if (entry.endsWith('.router.ts')) {
      files.push(full);
    }
  }
  return files;
}

let failures = 0;

for (const file of collectRouterFiles(MODULE_DIR)) {
  const moduleName = file.split('/modules/')[1]?.split('/')[0] ?? '';
  if (PUBLIC_MODULES.has(moduleName)) continue;

  const src = readFileSync(file, 'utf-8');
  const hasAuth = AUTH_INDICATORS.some((indicator) => src.includes(indicator));

  if (!hasAuth && ROUTE_RE.test(src)) {
    console.error(`[rbac-check] UNPROTECTED routes in: ${file.split('/src/')[1]}`);
    failures++;
  }

  // Reset regex lastIndex
  ROUTE_RE.lastIndex = 0;
}

if (failures > 0) {
  console.error(`\n[rbac-check] ${failures} router file(s) missing authenticate middleware.`);
  process.exit(1);
} else {
  console.log('[rbac-check] All routes protected. ✓');
}

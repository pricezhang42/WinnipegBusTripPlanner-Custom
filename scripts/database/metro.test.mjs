import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { ROOT } from './core.mjs';

const require = createRequire(import.meta.url);

test('mobile resolver excludes private database inputs but retains app code and public env file', () => {
  const config = require('../../metro.config.js');
  const blocked = file => config.resolver.blockList.some(pattern => pattern.test(resolve(ROOT, file)));
  for (const file of ['.env.database.local', '.env.database.example', '.database/qa-accounts.json',
    'scripts/database/qa.mjs', 'supabase/audit.sql', 'prod-ca-2021.crt', 'prod-ca-2021-qa.crt']) {
    assert.equal(blocked(file), true, `${file} must stay outside the mobile graph`);
  }
  for (const file of ['app/(tabs)/index.tsx', 'lib/supabase.ts', '.env.local', 'assets/alert.mp3']) {
    assert.equal(blocked(file), false, `${file} must remain available`);
  }
});

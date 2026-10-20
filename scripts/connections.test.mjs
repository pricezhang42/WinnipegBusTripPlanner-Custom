import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { selection, localSettings, publicSupabase, cleanEnvironment } from './connections.mjs';
const qa1 = 'abcdefghijklmnopqrst', qa2 = 'tsrqponmlkjihgfedcba';
const key = 'sb_publishable_test';
const base = ref => `https://${ref}.supabase.co`;

test('selectors reject duplicate, missing or invalid profile names', () => {
  for (const args of [['--api'], ['--api','../qa'], ['--api','qa1','--api','qa2']]) {
    assert.throws(() => selection(args, ['api']));
  }
  assert.deepEqual(selection(['--api','qa1','--clear'], ['api']), { selected: { api:'qa1' }, rest:['--clear'] });
});
test('profile files are parsed as data and process environment wins', async () => {
  const root = await mkdtemp(join(tmpdir(), 'connections-'));
  try {
    await writeFile(join(root, '.env.connections.local'), 'QA1_API_URL="https://file.example"\nLITERAL="$(touch not-executed)"\n');
    const result = await localSettings(pathToFileURL(root + '/'), { QA1_API_URL:'https://process.example' });
    assert.equal(result.QA1_API_URL, 'https://process.example');
    assert.equal(result.LITERAL, '$(touch not-executed)');
  } finally { await rm(root, { recursive:true }); }
});
test('public Supabase selection rejects secret keys and mismatched legacy projects', () => {
  assert.equal(publicSupabase(base(qa1), key).ref, qa1);
  const jwt = claims => `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
  assert.equal(publicSupabase(base(qa1), jwt({role:'anon',ref:qa1})).ref, qa1);
  for (const val of ['sb_secret_forbidden', jwt({role:'service_role',ref:qa1}), jwt({role:'anon',ref:qa2}), 'garbage']) {
    assert.throws(() => publicSupabase(base(qa1), val));
  }
});
test('child environment removes operator secrets and unselected connection blocks', () => {
  const dirty = { PATH:'/usr/bin', QA1_DATABASE_URL:'secret', QA2_SUPABASE_ADMIN_KEY:'secret',
    SUPABASE_ACCESS_TOKEN:'secret', FLY_API_TOKEN:'secret', QA1_WT_API_KEY:'secret',
    QA2_MAPBOX_TOKEN:'secret', PRODUCTION_SUPABASE_PUBLISHABLE_KEY:'other',
    EXPO_PUBLIC_BACKEND_URL:'https://old.example', QA1_FLY_APP:'old', QA2_PORT:'9999',
    QA1_RELIABILITY_DATA_PATH:'/private/data', SAVED_ITEMS_TEST_TOKEN_A:'private' };
  assert.deepEqual(cleanEnvironment(dirty), { PATH:'/usr/bin' });
});

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { appPlan } from './run.mjs';
const settings = { LOCAL_API_URL:'http://10.0.2.2:18787', PRODUCTION_API_URL:'https://prod.example',
  QA1_SUPABASE_URL:base(qa1), QA1_SUPABASE_PUBLISHABLE_KEY:key,
  QA2_SUPABASE_URL:base(qa2), QA2_SUPABASE_PUBLISHABLE_KEY:key };
test('API and Auth profiles are independently selected and override stale public values', () => {
  const plan = appPlan(['android','--api','production','--auth','qa2','--variant','release'], settings,
    { PATH:'/usr/bin', EXPO_PUBLIC_BACKEND_URL:'stale', EXPO_PUBLIC_SUPABASE_URL:'stale', PRODUCTION_DATABASE_URL:'private' });
  assert.equal(plan.env.EXPO_PUBLIC_BACKEND_URL, 'https://prod.example');
  assert.equal(plan.env.EXPO_PUBLIC_SUPABASE_URL, base(qa2));
  assert.equal(plan.env.EXPO_NO_DOTENV,'1');
  assert.equal(plan.env.PRODUCTION_DATABASE_URL, undefined);
  assert.deepEqual(plan.args, ['run:android','--variant','release']);
  assert.equal(JSON.stringify(plan.summary).includes(key), false);
});
test('guest profile is explicit and incomplete/unknown selections never fall back', () => {
  assert.equal(appPlan(['start','--api','local','--auth','none'],settings,{}).env.EXPO_PUBLIC_SUPABASE_URL, '');
  for (const args of [['start','--api','local'], ['start','--api','typo','--auth','qa1'], ['start','--api','local','--auth','qa9']]) {
    assert.throws(() => appPlan(args,settings,{}));
  }
  assert.equal(appPlan(['web'],settings,{PATH:'test'}).env.PATH,'test');
  assert.equal(appPlan(['export','--api','local','--auth','qa1','--print'],settings,{}).print, true);
});
test('Metro excludes profile files, retained private artifacts and Node tools', () => {
  const require = createRequire(import.meta.url);
  const config = require('../metro.config.js');
  const blocked = name => config.resolver.blockList.some(pattern => pattern.test(fileURLToPath(new URL('../'+name,import.meta.url))));
  for (const name of ['.env.connections.local','.env.connections.example','.env.database.local','.database/qa.dump',
    'scripts/run.mjs','scripts/connections.mjs','prod-ca-2021.crt','supabase/.temp/config']) assert.equal(blocked(name), true, name);
  for (const name of ['lib/supabase.ts','.env.local','app/(tabs)/index.tsx']) assert.equal(blocked(name),false,name);
});

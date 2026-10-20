import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { selection, localSettings, value, connectionUrl, publicSupabase, cleanEnvironment } from './connections.mjs';
const root = new URL('../', import.meta.url);
const commands = { start: ['start'], android: ['run:android'], ios: ['run:ios'], web: ['start', '--web'], export: ['export'] };

export function appPlan(args, settings, inherited = process.env) {
  const [command, ...flags] = args;
  if (!commands[command]) throw new Error('Use start, android, ios, web or export.');
  const { selected, rest } = selection(flags, ['api', 'auth']);
  const print = rest.includes('--print');
  const extra = rest.filter(flag => flag !== '--print');
  let env = { ...inherited }, summary = { mode: 'existing Expo environment' };
  if (Object.keys(selected).length) {
    if (!selected.api || !selected.auth) throw new Error('Select both --api <profile> and --auth <profile|none>; the choices are independent.');
    env = { ...cleanEnvironment(inherited), EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_BACKEND_URL: connectionUrl(value(settings, selected.api, 'API_URL'), 'API'),
      EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '' };
    if (selected.auth !== 'none') {
      const auth = publicSupabase(value(settings, selected.auth, 'SUPABASE_URL'), value(settings, selected.auth, 'SUPABASE_PUBLISHABLE_KEY'));
      env.EXPO_PUBLIC_SUPABASE_URL = auth.url;
      env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = auth.key;
    }
    summary = { api: selected.api, backendUrl: env.EXPO_PUBLIC_BACKEND_URL, auth: selected.auth,
      authUrl: env.EXPO_PUBLIC_SUPABASE_URL || null };
  }
  return { command: fileURLToPath(new URL('../node_modules/.bin/expo', import.meta.url)),
    args: [...commands[command], ...extra], env, summary, print };
}
export async function main(args = process.argv.slice(2)) {
  const plan = appPlan(args, await localSettings(root));
  console.log(JSON.stringify(plan.summary));
  if (plan.print) return;
  const child = spawn(plan.command, plan.args, { cwd: fileURLToPath(root), env: plan.env, stdio: 'inherit', shell: false });
  await new Promise((resolve, reject) => {
    child.on('error', () => reject(new Error('Could not start Expo. Run npm ci.')));
    child.on('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1); resolve(); });
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

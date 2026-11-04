// Runs the API server (with auto-reload) and the Vite dev server together.
import { spawn } from 'node:child_process';

const opts = { stdio: 'inherit', shell: process.platform === 'win32' };
const api = spawn('node', ['--watch', 'server/index.js'], opts);
const web = spawn('npx', ['vite'], opts);
const stop = () => {
  api.kill();
  web.kill();
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

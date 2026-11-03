import { spawn } from 'node:child_process';

const child = spawn('uvx', ['--from', 'wireshark-mcp', 'wireshark-mcp', 'serve'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env },
});

let buf = '';
const pending = new Map();
child.stderr.on('data', (d) => process.stderr.write('[stderr] ' + d));
child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  }
});

function rpc(method, params, id) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout ' + method)), 180000);
    pending.set(id, (m) => { clearTimeout(timer); resolve(m); });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

try {
  const init = await rpc('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'dsh-probe', version: '1.0.0' },
  }, 1);
  console.log('INIT:', JSON.stringify(init.result?.serverInfo));
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tools = await rpc('tools/list', {}, 2);
  const names = (tools.result?.tools ?? []).map((t) => t.name);
  console.log('TOOLS:', names.length);
  console.log(names.slice(0, 8).join(', '));
} catch (e) {
  console.log('ERROR:', e.message);
} finally {
  child.kill();
}

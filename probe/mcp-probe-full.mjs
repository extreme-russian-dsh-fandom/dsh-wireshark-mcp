import { spawn } from 'node:child_process';

const child = spawn('uvx', ['--from', 'wireshark-mcp', 'wireshark-mcp', 'serve', '--profile', 'full'], {
  stdio: ['pipe', 'pipe', 'pipe'],
  env: { ...process.env, WIRESHARK_MCP_ALLOWED_DIRS: '', WIRESHARK_MCP_MAX_RESULT_CHARS: '8000' },
});

let buf = '';
let done = false;
const timer = setTimeout(() => {
  if (!done) { console.log('TIMEOUT'); child.kill(); process.exit(1); }
}, 120000);

child.stderr.on('data', (d) => process.stderr.write('[stderr] ' + d));
child.stdout.on('data', (d) => {
  buf += d.toString();
  let idx;
  while ((idx = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id === 1) {
      console.log('INIT:', JSON.stringify(msg.result?.serverInfo), 'error:', JSON.stringify(msg.error));
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }) + '\n');
    }
    if (msg.id === 2) {
      console.log('TOOLS:', (msg.result?.tools ?? []).length);
      const names = (msg.result?.tools ?? []).map((t) => t.name);
      console.log('HAS_CAPTURE:', names.includes('wireshark_capture'));
      done = true;
      clearTimeout(timer);
      child.kill();
    }
  }
});
child.stdin.write(JSON.stringify({
  jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'probe', version: '1' },
  },
}) + '\n');

// @ts-check
'use strict';

const WebSocket = require('ws');
const WebSocketServer = WebSocket.WebSocketServer || WebSocket.Server;
const http = require('http');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8766;
const REPO_PATH = path.resolve(process.env.CLAWFACE_REPO_PATH || process.cwd());
const SESSION_ID = process.env.OPENCLAW_SESSION_ID || 'agent:main:main';
const THREAD_ID = process.env.OPENCLAW_THREAD_ID || SESSION_ID;
const FINGERPRINT = crypto.createHash('sha256').update(`${os.hostname()}:${REPO_PATH}:${SESSION_ID}`).digest('hex').slice(0, 16);
const ONE_TIME_CODE = crypto.randomBytes(4).toString('hex');
const pendingPairCodes = new Set([ONE_TIME_CODE]);
const activeSessions = new Map();
const revokedSessionKeys = new Set();

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

function getLocalIp() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function currentBranch(repoPath) {
  try {
    const head = require('fs').readFileSync(path.join(repoPath, '.git', 'HEAD'), 'utf8').trim();
    return head.startsWith('ref: refs/heads/') ? head.replace('ref: refs/heads/', '') : head.slice(0, 12);
  } catch {
    return undefined;
  }
}

// The wire-protocol AgentContext fields are vendor-neutral. The bridge is a
// local OpenClaw-specific adapter, but it advertises Agent Context using the
// generic field names defined in docs/PROTOCOL.md so non-OpenClaw runtimes
// can satisfy the same contract without changing the ClawFace mobile client.
const CONTEXT = {
  repoPath: REPO_PATH,
  repoName: path.basename(REPO_PATH),
  branch: currentBranch(REPO_PATH),
  agentSessionId: SESSION_ID,
  agentThreadId: THREAD_ID,
};

function send(ws, payload) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
}

function deriveSessionKey(clientKey) {
  return crypto.createHmac('sha256', FINGERPRINT).update(String(clientKey || '')).digest('hex');
}

function createThread(agentId, title) {
  return {
    id: `openclaw:${THREAD_ID}:${Date.now()}`,
    agentId,
    title: title || `${CONTEXT.repoName} · ${CONTEXT.branch || 'session'}`,
    folder: CONTEXT.repoName,
    updatedMin: 0,
    unread: 0,
    preview: `${CONTEXT.repoPath} · ${THREAD_ID}`,
    context: CONTEXT,
    messages: [],
  };
}

function renderAgentResult(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) return 'OpenClaw command finished without text output.';
  try {
    const parsed = JSON.parse(trimmed);
    return parsed.response || parsed.message || parsed.text || JSON.stringify(parsed, null, 2);
  } catch {
    return trimmed;
  }
}

function runOpenClawTurn(text) {
  return new Promise((resolve) => {
    // TODO(CF-014): replace this narrow CLI adapter with a first-class OpenClaw
    // session event API when one is available. Today it targets an explicit
    // session id and falls back to a local echo so bridge testing stays honest
    // and never pretends to have delivered to OpenClaw when the CLI fails.
    const args = ['agent', '--session-id', SESSION_ID, '--message', text, '--json', '--timeout', '120'];
    execFile('openclaw', args, { cwd: REPO_PATH, timeout: 130_000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (!error) {
        resolve({ text: renderAgentResult(stdout), usedFallback: false });
        return;
      }
      const detail = (stderr || error.message || 'unknown error').trim().split('\n').slice(-3).join('\n');
      resolve({
        text: `OpenClaw CLI adapter unavailable for session ${SESSION_ID}. Local bridge fallback echo: ${text}` + (detail ? `\n\nAdapter detail: ${detail}` : ''),
        usedFallback: true,
      });
    });
  });
}

function sessionForHello(msg) {
  const key = String(msg.sessionKey || '');
  if (revokedSessionKeys.has(key)) return null;
  const session = activeSessions.get(key);
  if (!session) return null;
  if (session.context.agentSessionId !== SESSION_ID || session.context.agentThreadId !== THREAD_ID) return null;
  return session;
}

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/pair') wss.handleUpgrade(req, socket, head, ws => handlePairSocket(ws));
  else if (req.url === '/agent') wss.handleUpgrade(req, socket, head, ws => handleAgentSocket(ws));
  else socket.destroy();
});

function handlePairSocket(ws) {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { ws.close(); return; }
    if (msg.type !== 'pair') return;
    if (!pendingPairCodes.has(msg.code)) {
      send(ws, { type: 'error', error: 'Invalid or expired code' });
      ws.close();
      return;
    }
    const sessionKey = deriveSessionKey(msg.clientKey);
    pendingPairCodes.delete(msg.code);
    revokedSessionKeys.delete(sessionKey);
    activeSessions.set(sessionKey, { context: CONTEXT, createdAt: Date.now() });
    send(ws, { type: 'session', sessionKey, fingerprint: FINGERPRINT, context: CONTEXT });
    console.log(`[pair] paired ${CONTEXT.repoName} session=${SESSION_ID}`);
  });
}

function handleAgentSocket(ws) {
  let sessionKey = null;
  let authed = false;
  let agentId = 'openclaw-local';

  send(ws, { type: 'ready' });

  ws.on('message', async raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.type === 'hello') {
      const session = sessionForHello(msg);
      if (!session) {
        send(ws, { type: 'error', error: 'Invalid, revoked, unknown, or mismatched OpenClaw session' });
        ws.close();
        return;
      }
      sessionKey = msg.sessionKey;
      authed = true;
      console.log(`[agent] hello version=${msg.clientVersion} repo=${CONTEXT.repoPath} session=${SESSION_ID}`);
      return;
    }

    if (!authed) {
      send(ws, { type: 'error', error: 'hello required before agent messages' });
      ws.close();
      return;
    }

    switch (msg.type) {
      case 'ping':
        send(ws, { type: 'pong' });
        break;
      case 'revoke_session':
        if (sessionKey) {
          activeSessions.delete(sessionKey);
          revokedSessionKeys.add(sessionKey);
        }
        send(ws, { type: 'message', threadId: msg.threadId || THREAD_ID, message: { id: Date.now(), role: 'agent', text: 'ClawFace session revoked for this OpenClaw binding.', t: 'now' } });
        ws.close();
        break;
      case 'register_push':
        console.log('[agent] push token registered for local bridge');
        break;
      case 'create_thread': {
        agentId = msg.agentId || agentId;
        send(ws, { type: 'thread', thread: createThread(agentId, msg.title), clientRequestId: msg.clientRequestId });
        break;
      }
      case 'approval_decision':
        // CF-015 owns approval cards. Keep this bridge explicit and non-functional.
        send(ws, { type: 'error', error: 'Approval bridging is not implemented in CF-014' });
        break;
      case 'user_message': {
        const threadId = String(msg.threadId || THREAD_ID);
        send(ws, {
          type: 'message',
          threadId,
          message: { id: Date.now(), role: 'tool', name: 'openclaw_agent', arg: `${CONTEXT.repoName} · ${SESSION_ID}`, status: 'running', t: 'now' },
        });
        const result = await runOpenClawTurn(String(msg.text || ''));
        send(ws, {
          type: 'message',
          threadId,
          message: { id: Date.now(), role: 'agent', text: result.text, t: 'now' },
        });
        setTimeout(() => {
          send(ws, {
            type: 'message',
            threadId,
            message: {
              id: Date.now(),
              role: 'tool',
              name: result.usedFallback ? 'openclaw_adapter_fallback' : 'openclaw_agent',
              arg: `${CONTEXT.repoName} · ${SESSION_ID}`,
              status: 'done',
              result: result.usedFallback ? 'Local fallback event routed to this ClawFace thread.' : 'OpenClaw CLI turn completed for this bound session.',
              t: 'now',
            },
          });
        }, 50);
        break;
      }
      default:
        send(ws, { type: 'error', error: `Unknown message type: ${msg.type}` });
    }
  });
}

server.listen(PORT, '0.0.0.0', () => {
  const host = getLocalIp();
  const payload = { v: 1, host, port: PORT, fingerprint: FINGERPRINT, code: ONE_TIME_CODE, name: `OpenClaw · ${CONTEXT.repoName}`, context: CONTEXT };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
  console.log('\n=== ClawFace OpenClaw Local Bridge ===');
  console.log(`Listening on ws://${host}:${PORT}`);
  console.log(`Repo: ${CONTEXT.repoPath}`);
  console.log(`Branch: ${CONTEXT.branch || '(unknown)'}`);
  console.log(`OpenClaw session: ${SESSION_ID}`);
  console.log(`OpenClaw thread: ${THREAD_ID}`);
  console.log('\nPaste this JSON into ClawFace:');
  console.log(JSON.stringify(payload));
  console.log('\nQR/link source:');
  console.log(`clawface://${encoded}`);
  console.log('');
});

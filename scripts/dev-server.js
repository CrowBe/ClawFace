// @ts-check
'use strict';

const { WebSocketServer } = require('ws');
const http = require('http');
const crypto = require('crypto');
const os = require('os');

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8765;

const server = http.createServer();
const wss = new WebSocketServer({ noServer: true });

const ONE_TIME_CODE = crypto.randomBytes(4).toString('hex');
const pendingPairCodes = new Map();
pendingPairCodes.set(ONE_TIME_CODE, true);

const pushTokens = new Map();
const seenApprovalReqIds = new Set();
const activeSessionKeys = new Set();
const revokedSessionKeys = new Set();

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

const HOST = getLocalIp();

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/pair') {
    wss.handleUpgrade(req, socket, head, ws => handlePairSocket(ws));
  } else if (req.url === '/agent') {
    wss.handleUpgrade(req, socket, head, ws => handleAgentSocket(ws));
  } else {
    socket.destroy();
  }
});

function handlePairSocket(ws) {
  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { ws.close(); return; }

    if (msg.type === 'pair') {
      if (pendingPairCodes.has(msg.code)) {
        const sessionKey = crypto.createHmac('sha256', 'dev-secret').update(msg.clientKey).digest('hex');
        pendingPairCodes.delete(msg.code);
        activeSessionKeys.add(sessionKey);
        revokedSessionKeys.delete(sessionKey);
        ws.send(JSON.stringify({ type: 'session', sessionKey, fingerprint: 'dev-fp' }));
        console.log(`[pair] Paired. Session key issued.`);
      } else {
        ws.send(JSON.stringify({ type: 'error', error: 'Invalid or expired code' }));
        ws.close();
      }
    }
  });
}

function handleAgentSocket(ws) {
  let agentId = null;
  let sessionKey = null;
  let pingTimer = null;

  ws.send(JSON.stringify({ type: 'ready' }));

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    switch (msg.type) {
      case 'hello':
        if (revokedSessionKeys.has(msg.sessionKey) || !activeSessionKeys.has(msg.sessionKey)) {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid or revoked session' }));
          ws.close();
          break;
        }
        sessionKey = msg.sessionKey;
        agentId = 'server-agent';
        console.log(`[agent] hello from client, version=${msg.clientVersion}`);
        break;

      case 'user_message': {
        const { threadId, text, tempId } = msg;
        console.log(`[agent] user_message threadId=${threadId} text="${text}"`);

        let accumulated = '';
        const response = 'Got it — on it.';
        const chunkSize = 3;

        let i = 0;
        const streamInterval = setInterval(() => {
          if (i >= response.length) {
            clearInterval(streamInterval);

            ws.send(JSON.stringify({
              type: 'message',
              threadId,
              message: {
                id: Date.now(),
                role: 'agent',
                text: response,
                t: 'now',
              },
            }));

            setTimeout(() => {
              const toolMsgId = Date.now() + 10;
              ws.send(JSON.stringify({
                type: 'message',
                threadId,
                message: {
                  id: toolMsgId,
                  role: 'tool',
                  name: 'write_file',
                  arg: 'src/output.ts',
                  status: 'running',
                  t: 'now',
                },
              }));

              setTimeout(() => {
                const approvalId = Date.now() + 20;
                const reqId = crypto.randomUUID();
                const expiresAt = Date.now() + 300_000;
                ws.send(JSON.stringify({
                  type: 'approval_request',
                  threadId,
                  message: {
                    id: approvalId,
                    role: 'approval',
                    reqId,
                    expiresAt,
                    tool: 'write_files',
                    summary: 'Write 1 file',
                    risk: 'write',
                    files: ['src/output.ts (new)'],
                    diff: [
                      { type: 'plus', text: 'export const result = "hello from agent";' },
                    ],
                    status: 'pending',
                    t: 'now',
                  },
                }));
                console.log(`[agent] sent approval_request id=${approvalId} reqId=${reqId}`);
              }, 500);
            }, 300);

            return;
          }

          const chunk = response.slice(i, i + chunkSize);
          accumulated += chunk;
          i += chunkSize;

          ws.send(JSON.stringify({
            type: 'message_delta',
            threadId,
            msgId: tempId ?? Date.now(),
            textDelta: chunk,
          }));
        }, 120);
        break;
      }

      case 'approval_decision':
        if (seenApprovalReqIds.has(msg.reqId)) {
          console.log(`[agent] duplicate approval decision ignored reqId=${msg.reqId}`);
          break;
        }
        seenApprovalReqIds.add(msg.reqId);
        console.log(`[agent] approval decision: ${msg.decision} for msgId=${msg.msgId} reqId=${msg.reqId}`);
        ws.send(JSON.stringify({
          type: 'message',
          threadId: msg.threadId,
          message: {
            id: Date.now(),
            role: 'agent',
            text: msg.decision === 'approved' ? 'Approved — running now.' : 'Canceled.',
            t: 'now',
          },
        }));
        break;

      case 'create_thread': {
        const thread = {
          id: `${msg.agentId}-${Date.now()}`,
          agentId: msg.agentId,
          title: msg.title ?? 'New thread',
          folder: null,
          updatedMin: 0,
          unread: 0,
          preview: '',
          messages: [],
        };
        ws.send(JSON.stringify({ type: 'thread', thread, clientRequestId: msg.clientRequestId }));
        break;
      }

      case 'register_push':
        if (agentId) pushTokens.set(agentId, msg.token);
        console.log(`[agent] push token registered: ${msg.token}`);
        break;

      case 'revoke_session':
        if (sessionKey) {
          activeSessionKeys.delete(sessionKey);
          revokedSessionKeys.add(sessionKey);
        }
        console.log('[agent] session revoked');
        ws.close();
        break;

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong' }));
        break;
    }
  });

  ws.on('close', () => {
    if (pingTimer) clearInterval(pingTimer);
    console.log('[agent] client disconnected');
  });
}

server.listen(PORT, '0.0.0.0', () => {
  const payload = JSON.stringify({ v: 1, host: HOST, port: PORT, fingerprint: 'dev-fp', code: ONE_TIME_CODE, name: 'Dev Agent' });
  console.log('\n=== ClawFace Dev Server ===');
  console.log(`Listening on ws://${HOST}:${PORT}`);
  console.log(`\nOne-time code: ${ONE_TIME_CODE}`);
  console.log('\nPaste this JSON into the app "Paste link" field:');
  console.log(payload);
  console.log('');
});

import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import crypto from 'crypto'

// Authoritative server-side capture session store in dev server memory
interface ServerSession {
  id: string;
  token: string;
  userId: string;
  role: string;
  communityId: string;
  draftType: string;
  draftId: string;
  createdAt: string;
  expiresAt: string;
  isConsumed: boolean;
  consumedAt?: string;
  consumedWithImageHash?: string;
}

const serverSessions = new Map<string, ServerSession>();

function captureSessionApiPlugin(): Plugin {
  return {
    name: 'capture-session-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/capture-session')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        res.setHeader('Content-Type', 'application/json');

        // Helper to read request body JSON
        const readJsonBody = async () => {
          return new Promise<any>((resolve, reject) => {
            let body = '';
            req.on('data', (chunk) => (body += chunk));
            req.on('end', () => {
              try {
                resolve(body ? JSON.parse(body) : {});
              } catch (e) {
                reject(e);
              }
            });
            req.on('error', reject);
          });
        };

        try {
          if (url.pathname === '/api/capture-session/create' && req.method === 'POST') {
            const data = await readJsonBody();
            const id = crypto.randomUUID();
            const token = `cs_${crypto.randomBytes(16).toString('hex')}`;
            const now = Date.now();
            const session: ServerSession = {
              id,
              token,
              userId: data.userId || 'anonymous',
              role: data.role || 'Resident',
              communityId: data.communityId || 'default',
              draftType: data.draftType || 'complaint',
              draftId: data.draftId || 'draft-default',
              createdAt: new Date(now).toISOString(),
              expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
              isConsumed: false,
            };

            serverSessions.set(id, session);
            res.statusCode = 201;
            res.end(JSON.stringify({ ok: true, session }));
            return;
          }

          if (url.pathname === '/api/capture-session/validate' && req.method === 'POST') {
            const data = await readJsonBody();
            const session = serverSessions.get(data.sessionId);

            if (!session) {
              res.statusCode = 404;
              res.end(JSON.stringify({ valid: false, error: 'Session not found' }));
              return;
            }

            if (session.isConsumed) {
              res.statusCode = 409;
              res.end(JSON.stringify({ valid: false, error: 'Capture session already consumed' }));
              return;
            }

            if (Date.now() > new Date(session.expiresAt).getTime()) {
              res.statusCode = 410;
              res.end(JSON.stringify({ valid: false, error: 'Capture session expired' }));
              return;
            }

            if (data.userId && session.userId !== data.userId) {
              res.statusCode = 403;
              res.end(JSON.stringify({ valid: false, error: 'Session ownership mismatch' }));
              return;
            }

            // Compute server hash if base64 provided
            let imageHash = data.imageHash || '';
            if (data.imageBase64) {
              imageHash = crypto.createHash('sha256').update(Buffer.from(data.imageBase64, 'base64')).digest('hex');
            }

            const serverReceivedTimestamp = new Date().toISOString();
            session.isConsumed = true;
            session.consumedAt = serverReceivedTimestamp;
            session.consumedWithImageHash = imageHash;

            res.statusCode = 200;
            res.end(
              JSON.stringify({
                valid: true,
                sessionId: session.id,
                imageHash,
                serverReceivedTimestamp,
              })
            );
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: 'Endpoint not found' }));
        } catch (err: any) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err?.message || 'Server error' }));
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), captureSessionApiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})

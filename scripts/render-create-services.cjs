#!/usr/bin/env node

const https = require('https');
const crypto = require('crypto');

const API_BASE = 'https://api.render.com/v1';
const DRY_RUN = process.argv.includes('--dry-run');

const env = process.env;

const config = {
  apiKey: env.RENDER_API_KEY,
  ownerId: env.RENDER_OWNER_ID,
  repo: env.RENDER_REPO_URL || 'https://github.com/sepe-beweb/salguacate-erp',
  branch: env.RENDER_BRANCH || 'main',
  backendName: env.RENDER_BACKEND_NAME || 'salguacate-backend',
  frontendName: env.RENDER_FRONTEND_NAME || 'salguacate-frontend',
  backendRegion: env.RENDER_BACKEND_REGION || 'oregon',
  enableDisk: env.RENDER_ENABLE_DISK !== 'false',
  geminiKey: env.GEMINI_API_KEY,
  jwtSecret: env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
};
config.backendPlan = env.RENDER_BACKEND_PLAN || (config.enableDisk ? 'starter' : 'free');

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function request(method, path, body) {
  const payload = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve, reject) => {
    const req = https.request(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = null;
        if (data) {
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(parsed);
        } else {
          reject(new Error(`${method} ${path} failed (${res.statusCode}): ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function findServiceByName(name) {
  const services = await request('GET', '/services?limit=100');
  const match = services.find(item => item.service && item.service.name === name);
  return match ? match.service : null;
}

async function resolveOwnerId() {
  if (config.ownerId) return config.ownerId;

  const owners = await request('GET', '/owners?limit=20');
  const ownerList = owners.map(item => item.owner).filter(Boolean);

  if (ownerList.length === 1) {
    const [owner] = ownerList;
    console.log(`Using Render owner: ${owner.name} (${owner.id})`);
    return owner.id;
  }

  const formatted = ownerList.map(owner => `- ${owner.name} (${owner.type}): ${owner.id}`).join('\n');
  throw new Error(`Set RENDER_OWNER_ID. Available owners:\n${formatted || '(none found)'}`);
}

async function createService(payload) {
  if (DRY_RUN) {
    console.log(JSON.stringify(payload, null, 2));
    return { id: 'dry-run', name: payload.name, dashboardUrl: null };
  }

  const existing = await findServiceByName(payload.name);
  if (existing) {
    console.log(`Service already exists: ${payload.name} (${existing.id})`);
    return existing;
  }

  console.log(`Creating service: ${payload.name}`);
  return request('POST', '/services', payload);
}

async function main() {
  requireEnv('RENDER_API_KEY', config.apiKey);
  requireEnv('GEMINI_API_KEY', config.geminiKey);

  config.ownerId = await resolveOwnerId();

  const backendUrl = `https://${config.backendName}.onrender.com`;

  const backendDetails = {
    runtime: 'node',
    plan: config.backendPlan,
    region: config.backendRegion,
    envSpecificDetails: {
      buildCommand: 'npm ci',
      startCommand: 'npm start',
    },
  };

  if (config.enableDisk) {
    backendDetails.disk = {
      name: 'data',
      mountPath: '/opt/render/project/src/server/persistent',
      sizeGB: 1,
    };
  } else {
    console.warn('WARNING: RENDER_ENABLE_DISK=false. SQLite data and uploads will be ephemeral on Render.');
  }

  const backend = await createService({
    type: 'web_service',
    name: config.backendName,
    ownerId: config.ownerId,
    repo: config.repo,
    branch: config.branch,
    rootDir: 'server',
    autoDeploy: 'yes',
    envVars: [
      { key: 'NODE_ENV', value: 'production' },
      { key: 'SQLITE_DATABASE_PATH', value: '/opt/render/project/src/server/persistent/database.sqlite' },
      { key: 'UPLOADS_DIR', value: '/opt/render/project/src/server/persistent/uploads' },
      { key: 'GEMINI_API_KEY', value: config.geminiKey },
      { key: 'JWT_SECRET', value: config.jwtSecret },
    ],
    serviceDetails: backendDetails,
  });

  const frontend = await createService({
    type: 'static_site',
    name: config.frontendName,
    ownerId: config.ownerId,
    repo: config.repo,
    branch: config.branch,
    autoDeploy: 'yes',
    envVars: [
      { key: 'VITE_API_URL', value: backendUrl },
    ],
    serviceDetails: {
      buildCommand: 'npm ci && npm run build',
      publishPath: './dist',
      routes: [
        { type: 'rewrite', source: '/*', destination: '/index.html' },
      ],
    },
  });

  console.log('\nRender services ready:');
  console.log(`Backend:  ${backend.name || config.backendName} ${backend.dashboardUrl || ''}`);
  console.log(`Frontend: ${frontend.name || config.frontendName} ${frontend.dashboardUrl || ''}`);
  console.log(`API URL:  ${backendUrl}`);
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});

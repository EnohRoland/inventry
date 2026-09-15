const { app, BrowserWindow, ipcMain } = require('electron');
app.setName('Goshenignite Inventory');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');
const crypto = require('node:crypto');
const { fork } = require('node:child_process');

const resourcesRoot = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, '..', 'vendor', 'resources');

const backendDist = path.join(resourcesRoot, 'backend', 'dist');
const frontendDist = path.join(resourcesRoot, 'frontend', 'dist');

const userDataDir = app.getPath('userData');
const pgDataDir = path.join(userDataDir, 'pgdata');
const configPath = path.join(userDataDir, 'desktop-config.json');
const logPath = path.join(userDataDir, 'app.log');

let pg;
let serverProcess;
let mainWindow;
let setupWindow;
let readyForWindowAllClosed = false;
let shuttingDown = false;

// A dependency (embedded-postgres, via async-exit-hook) re-invokes its own
// stop() during process exit even after we've already stopped it ourselves,
// and mishandles its completion callback on this platform/version. That
// throws after our own graceful shutdown has already succeeded, so it's
// swallowed here rather than left to crash the exiting process.
process.on('unhandledRejection', (err) => {
  log('[unhandled]', String(err));
});

function log(...args) {
  const line = `[${new Date().toISOString()}] ${args.join(' ')}\n`;
  try {
    fs.appendFileSync(logPath, line);
  } catch {
    /* Logging is best-effort; a full disk shouldn't crash the app. */
  }
  console.log(...args);
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

function loadOrCreateConfig() {
  fs.mkdirSync(userDataDir, { recursive: true });
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  const config = { pgPassword: crypto.randomBytes(24).toString('hex') };
  fs.writeFileSync(configPath, JSON.stringify(config));
  return config;
}

function runChildScript(scriptName, env) {
  return new Promise((resolve, reject) => {
    const child = fork(path.join(backendDist, scriptName), [], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', ...env },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    let stderr = '';
    child.stdout?.on('data', (d) => log(`[${scriptName}]`, d.toString().trim()));
    child.stderr?.on('data', (d) => {
      stderr += d.toString();
      log(`[${scriptName}:err]`, d.toString().trim());
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}: ${stderr.slice(0, 400)}`));
    });
  });
}

async function createAdmin({ email, password, includeSampleData }) {
  await runChildScript('seed.js', {
    DATABASE_URL: global.databaseUrl,
    SEED_ADMIN_EMAIL: email,
    SEED_ADMIN_PASSWORD: password,
    SEED_DEMO: includeSampleData ? 'true' : 'false',
  });
}

function openSetupWindow() {
  return new Promise((resolve, reject) => {
    setupWindow = new BrowserWindow({
      width: 480,
      height: 560,
      resizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    setupWindow.loadFile(path.join(__dirname, 'setup.html'));

    ipcMain.handle('create-admin', async (_event, payload) => {
      try {
        await createAdmin(payload);
        setupWindow.close();
        return { ok: true };
      } catch (err) {
        log('create-admin failed', String(err));
        return { ok: false, message: 'Could not create that account. Check the email format and use a password of 14+ characters.' };
      }
    });

    setupWindow.on('closed', () => {
      ipcMain.removeHandler('create-admin');
      setupWindow = null;
      resolve();
    });
  });
}

function createMainWindow(appUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.loadURL(appUrl);
  readyForWindowAllClosed = true;
  mainWindow.on('closed', () => {
    mainWindow = null;
    app.quit();
  });
}

async function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  log('Shutting down...');
  if (serverProcess) {
    serverProcess.kill();
  }
  if (pg) {
    try {
      await pg.stop();
    } catch (err) {
      log('Error stopping database', String(err));
    }
  }
}

async function main() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  const config = loadOrCreateConfig();
  const pgPort = await getFreePort();
  const appPort = await getFreePort();

  const clusterExists = fs.existsSync(path.join(pgDataDir, 'PG_VERSION'));

  pg = new EmbeddedPostgres({
    databaseDir: pgDataDir,
    user: 'postgres',
    password: config.pgPassword,
    port: pgPort,
    persistent: true,
    onLog: (msg) => log('[postgres]', String(msg).trim()),
    onError: (msg) => log('[postgres:err]', String(msg).trim()),
  });

  log('Starting database...', clusterExists ? '' : '(new cluster — initializing)');
  if (!clusterExists) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase('inventory');
  } catch (err) {
    // Already exists from a prior run — fine. Any other failure surfaces on connect below.
    log('createDatabase:', String(err).slice(0, 200));
  }

  global.databaseUrl = `postgres://postgres:${config.pgPassword}@127.0.0.1:${pgPort}/inventory`;
  const appOrigin = `http://127.0.0.1:${appPort}`;

  log('Running migrations...');
  await runChildScript('migrate.js', { DATABASE_URL: global.databaseUrl });

  // Never trust "was the cluster just created" as a proxy for "does an admin
  // account exist" — a crash between initializing Postgres and finishing setup
  // would otherwise permanently skip the setup screen. Ask the database instead.
  const client = pg.getPgClient('inventory');
  await client.connect();
  const { rowCount } = await client.query('SELECT 1 FROM users LIMIT 1');
  await client.end();
  const needsSetup = rowCount === 0;

  if (needsSetup) {
    log('No admin account yet — showing setup window');
    await openSetupWindow();
  }

  log('Starting application server on', appOrigin);
  serverProcess = fork(path.join(backendDist, 'server.js'), [], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      DATABASE_URL: global.databaseUrl,
      PORT: String(appPort),
      APP_ORIGIN: appOrigin,
      SERVE_FRONTEND_DIR: frontendDist,
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  serverProcess.stdout?.on('data', (d) => log('[server]', d.toString().trim()));
  serverProcess.stderr?.on('data', (d) => log('[server:err]', d.toString().trim()));

  // Give the server a moment to bind before pointing the window at it.
  await new Promise((resolve) => setTimeout(resolve, 800));
  createMainWindow(appOrigin);
}

app.on('window-all-closed', async () => {
  // During first-run setup, the setup window closing is a normal step on the
  // way to opening the main window — not a signal to quit.
  if (!readyForWindowAllClosed) return;
  await shutdown();
  app.quit();
});

app.on('before-quit', async (event) => {
  if (pg) {
    event.preventDefault();
    await shutdown();
    pg = null;
    app.quit();
  }
});

app.whenReady().then(() => {
  main().catch((err) => {
    log('Fatal startup error', String(err && err.stack ? err.stack : err));
    app.quit();
  });
});

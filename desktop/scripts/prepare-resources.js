// Rebuilds the frontend/backend and assembles desktop/vendor/resources, the
// staging tree that both `npm start` (dev) and electron-builder (packaging)
// read from. Run this after any change to backend/ or frontend/, before
// `npm run dist:win`.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.join(__dirname, '..', '..');
const desktopDir = path.join(__dirname, '..');
const resourcesDir = path.join(desktopDir, 'vendor', 'resources');
const runtimeStagingDir = path.join(desktopDir, 'vendor', 'backend-runtime');

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd, stdio: 'inherit', shell: true });
}

console.log('--- Building backend and frontend ---');
run('npm', ['run', 'build', '--workspace', 'backend'], repoRoot);
run('npm', ['run', 'build', '--workspace', 'frontend'], repoRoot);

console.log('--- Resolving exact production dependency versions ---');
const backendPkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'backend', 'package.json'), 'utf8'));
const exactDeps = {};
for (const name of Object.keys(backendPkg.dependencies)) {
  const installedPkgPath = path.join(repoRoot, 'node_modules', name, 'package.json');
  exactDeps[name] = JSON.parse(fs.readFileSync(installedPkgPath, 'utf8')).version;
}

console.log('--- Installing an isolated, production-only copy of those dependencies ---');
fs.rmSync(runtimeStagingDir, { recursive: true, force: true });
fs.mkdirSync(runtimeStagingDir, { recursive: true });
fs.writeFileSync(
  path.join(runtimeStagingDir, 'package.json'),
  JSON.stringify({ name: 'goshenignite-backend-runtime', private: true, version: '1.0.0', dependencies: exactDeps }, null, 2),
);
run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund'], runtimeStagingDir);

console.log('--- Assembling desktop/vendor/resources ---');
fs.rmSync(resourcesDir, { recursive: true, force: true });
fs.mkdirSync(path.join(resourcesDir, 'backend'), { recursive: true });
fs.mkdirSync(path.join(resourcesDir, 'frontend'), { recursive: true });
fs.cpSync(path.join(runtimeStagingDir, 'node_modules'), path.join(resourcesDir, 'node_modules'), { recursive: true });
fs.cpSync(path.join(repoRoot, 'backend', 'dist'), path.join(resourcesDir, 'backend', 'dist'), { recursive: true });
fs.cpSync(path.join(repoRoot, 'backend', 'migrations'), path.join(resourcesDir, 'backend', 'migrations'), { recursive: true });
fs.copyFileSync(path.join(repoRoot, 'backend', 'package.json'), path.join(resourcesDir, 'backend', 'package.json'));
fs.cpSync(path.join(repoRoot, 'frontend', 'dist'), path.join(resourcesDir, 'frontend', 'dist'), { recursive: true });

fs.rmSync(runtimeStagingDir, { recursive: true, force: true });

console.log('--- Done. Resources staged at desktop/vendor/resources ---');

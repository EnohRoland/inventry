// Run from a trusted operator machine with AWS CLI, kubectl, and cluster admin access.
import { execFileSync } from 'node:child_process';
const mode = process.argv[2];
if (!['provision', 'seed'].includes(mode))
  throw new Error('Usage: node scripts/admin-job.mjs provision|seed');
const required = (key) => {
  if (!process.env[key]) throw new Error(`${key} is required`);
  return process.env[key];
};
const image = required('BACKEND_IMAGE');
const namespace = 'goshenignite',
  name = `inventory-${mode}-${Date.now()}`;
const run = (args, input) =>
  execFileSync('kubectl', ['--namespace', namespace, ...args], {
    input,
    encoding: 'utf8',
    stdio: input ? ['pipe', 'pipe', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });
const data =
  mode === 'provision'
    ? {
        DB_ADMIN_JSON: execFileSync(
          'aws',
          [
            'secretsmanager',
            'get-secret-value',
            '--secret-id',
            required('DATABASE_MASTER_SECRET_ARN'),
            '--region',
            process.env.AWS_REGION || 'us-east-1',
            '--query',
            'SecretString',
            '--output',
            'text',
          ],
          { encoding: 'utf8' },
        ).trim(),
      }
    : {
        SEED_ADMIN_EMAIL: required('SEED_ADMIN_EMAIL'),
        SEED_ADMIN_PASSWORD: required('SEED_ADMIN_PASSWORD'),
      };
const secret = {
  apiVersion: 'v1',
  kind: 'Secret',
  metadata: { name, namespace },
  type: 'Opaque',
  stringData: data,
};
const job = {
  apiVersion: 'batch/v1',
  kind: 'Job',
  metadata: { name, namespace },
  spec: {
    backoffLimit: 0,
    activeDeadlineSeconds: 300,
    ttlSecondsAfterFinished: 3600,
    template: {
      metadata: { labels: { app: mode === 'provision' ? 'bootstrap' : 'seed' } },
      spec: {
        restartPolicy: 'Never',
        automountServiceAccountToken: false,
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 1000,
          runAsGroup: 1000,
          seccompProfile: { type: 'RuntimeDefault' },
        },
        containers: [
          {
            name: 'admin',
            image,
            command: ['node', `backend/dist/${mode === 'provision' ? 'provision' : 'seed'}.js`],
            env: [
              { name: 'DB_SSL_CA', value: '/app/certs/rds.pem' },
              { name: 'NODE_ENV', value: 'production' },
            ],
            envFrom: [{ secretRef: { name: 'inventory-db' } }, { secretRef: { name } }],
            securityContext: {
              allowPrivilegeEscalation: false,
              readOnlyRootFilesystem: true,
              capabilities: { drop: ['ALL'] },
            },
            resources: {
              requests: { cpu: '100m', memory: '128Mi' },
              limits: { cpu: '500m', memory: '256Mi' },
            },
          },
        ],
      },
    },
  },
};
try {
  run(['create', '-f', '-'], JSON.stringify(secret));
  run(['create', '-f', '-'], JSON.stringify(job));
  run(['wait', '--for=condition=complete', `job/${name}`, '--timeout=300s']);
  console.log(`${mode} completed`);
} catch {
  console.error(
    `${mode} failed. Inspect job ${name} in namespace ${namespace}; no secret values are printed.`,
  );
  process.exitCode = 1;
} finally {
  run(['delete', 'secret', name, '--ignore-not-found']);
}

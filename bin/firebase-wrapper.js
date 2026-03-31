#!/usr/bin/env node

import {readFileSync, writeFileSync, unlinkSync, existsSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';
import {execFileSync} from 'child_process';

const DEFAULT_FIRESTORE_PORT = 8080;
const DEFAULT_AUTH_PORT = 9099;
const DEFAULT_FUNCTIONS_PORT = 5001;
const DEFAULT_UI_PORT = 4000;

const projectDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const envFiles = ['.env', '.env.local'];
for (const envFile of envFiles) {
  const envPath = join(projectDir, envFile);
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split('\n')) {
      const match = line.match(/^(\w+)=(.*)$/);
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2];
      }
    }
  }
}

const baseConfigPath = join(projectDir, 'firebase.json');

const config = JSON.parse(readFileSync(baseConfigPath, 'utf8'));

config.emulators = config.emulators || {};
config.emulators.auth = {
  ...config.emulators.auth,
  port: Number(process.env.VITE_AUTH_PORT || DEFAULT_AUTH_PORT),
};
config.emulators.firestore = {
  ...config.emulators.firestore,
  port: Number(process.env.VITE_FIRESTORE_PORT || DEFAULT_FIRESTORE_PORT),
};
config.emulators.functions = {
  ...config.emulators.functions,
  port: Number(process.env.VITE_FUNCTIONS_PORT || DEFAULT_FUNCTIONS_PORT),
};
config.emulators.ui = {
  ...config.emulators.ui,
  port: Number(process.env.VITE_UI_PORT || DEFAULT_UI_PORT),
};

const tempConfig = join(projectDir, '.firebase-config.json');
writeFileSync(tempConfig, JSON.stringify(config, null, 2));

const args = ['--config', tempConfig, ...process.argv.slice(2)];

try {
  execFileSync('firebase', args, {stdio: 'inherit'});
} finally {
  try {
    unlinkSync(tempConfig);
  } catch {}
}

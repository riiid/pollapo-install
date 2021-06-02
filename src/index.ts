import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import stream from 'stream';
import util from 'util';

const DENO_INSTALL_SCRIPT_URL = 'https://deno.land/x/install/install.sh';
const POLLAPO_SCRIPT_URL = 'https://raw.githubusercontent.com/riiid/pbkit/v0.0.8/cli/pollapo/entrypoint.ts';

const CACHE_PATH = path.join(os.homedir(), '.config', 'pollapo', 'cache');
const CACHE_KEY_PREFIX = 'pollapo-install';
const CACHE_VERSION = '1';

const outDir = core.getInput('out-dir');
const token = core.getInput('token');
const config = core.getInput('config');
const workingDirectory = core.getInput('working-directory');

const outDirPath = path.resolve(path.join(workingDirectory, outDir));
const configPath = path.resolve(path.join(workingDirectory, config));
const denoPath = path.resolve(os.homedir(), '.deno', 'bin', 'deno');

async function main() {
  await setupDeno();
  const cacheKey = await restoreCache();
  await pollapoInstall();
  if (!cacheKey) {
    await saveCache();
  }
}

async function setupDeno() {
  await exec.exec(`/bin/bash -c "curl -fsSL ${DENO_INSTALL_SCRIPT_URL} | sh"`);
}

async function restoreCache(): Promise<string | undefined> {
  const cachePaths = [CACHE_PATH];
  const cacheKey = await getPrimaryCacheKey();
  const restoreKeys = getRestoreCacheKeys();
  return await cache.restoreCache(cachePaths, cacheKey, restoreKeys);
}

async function pollapoInstall() {
  await exec.exec(denoPath, [
    'run',
    '-A',
    '--unstable',
    POLLAPO_SCRIPT_URL,
    'install',
    '--out-dir',
    outDirPath,
    '--token',
    token,
    '--config',
    configPath,
  ]);
}

async function saveCache() {
  const cachePaths = [CACHE_PATH];
  const cacheKey = await getPrimaryCacheKey();
  try {
    await cache.saveCache(cachePaths, cacheKey);
  } catch (e) {
    if (e.name === cache.ReserveCacheError.name) {
      core.info(`Pollapo install cache entry \`${cacheKey}\` has been already created by another workflow.`);
    } else {
      throw e;
    }
  }
}

async function hashFile(path: string) {
  const result = crypto.createHash('sha256');
  await util.promisify(stream.pipeline)(fs.createReadStream(path), result);
  result.end();
  return result.digest('hex');
}

async function getPrimaryCacheKey() {
  const configHash = await hashFile(configPath);
  return [CACHE_KEY_PREFIX, CACHE_VERSION, configHash].join('-');
}

function getRestoreCacheKeys() {
  return [[CACHE_KEY_PREFIX, CACHE_VERSION, ''].join('-'), [CACHE_KEY_PREFIX, ''].join('-')];
}

(async () => {
  try {
    await main();
  } catch (e) {
    core.setFailed(e.message);
  }
})();

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as exec from '@actions/exec';
import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import stream from 'stream';
import util from 'util';
import * as commandExists from 'command-exists';

const POLLAPO_LINUX_TAR_URL = 'https://github.com/pbkit/pbkit/releases/download/v0.0.54/pbkit-x86_64-unknown-linux-gnu.tar';
const POLLAPO_MAC_TAR_URL = 'https://github.com/pbkit/pbkit/releases/download/v0.0.54/pbkit-aarch64-apple-darwin.tar';

const CACHE_PATH = path.join(os.homedir(), '.config', 'pollapo', 'cache');
const CACHE_KEY_PREFIX = 'pollapo-install';
const CACHE_VERSION = '1';

const outDir = core.getInput('out-dir');
const token = core.getInput('token');
const config = core.getInput('config');
const workingDirectory = core.getInput('working-directory');
const env = core.getInput('env');

const outDirPath = path.resolve(path.join(workingDirectory, outDir));
const configPath = path.resolve(path.join(workingDirectory, config));

const pollapoTarUrl = env === 'ubuntu'
  ? POLLAPO_LINUX_TAR_URL
  : env === 'macOs'
  ? POLLAPO_MAC_TAR_URL
  : (() => { throw new Error(`${env} is unsupported in env`) })();

async function main() {
  await setupPollapo();
  // const cacheKey = await restoreCache();
  await pollapoInstall();
  // if (!cacheKey) {
  //   await saveCache();
  // }
}

async function setupPollapo(): Promise<void> {
  await exec.exec(`/bin/bash -c "curl -L ${pollapoTarUrl} --output pollapo-${env}.tar"`);
  await exec.exec(`tar xf pollapo-${env}.tar`);
}

async function restoreCache(): Promise<string | undefined> {
  const cachePaths = [CACHE_PATH];
  const cacheKey = await getPrimaryCacheKey();
  const restoreKeys = getRestoreCacheKeys();
  return await cache.restoreCache(cachePaths, cacheKey, restoreKeys);
}

async function pollapoInstall() {
  await exec.exec("./pollapo", ["install", "--out-dir", outDirPath, "--token", token, "--config", configPath]);
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

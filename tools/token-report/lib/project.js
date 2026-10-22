'use strict';

const { execFileSync } = require('node:child_process');
const path = require('node:path');

function git(cwd, args) {
  try {
    return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim();
  } catch {
    return '';
  }
}

/** Repo name from a remote URL: https://host/org/cms-1019.git, git@host:org/cms-1019.git → cms-1019. */
function repoNameFromRemote(url) {
  const name = (url || '').trim().replace(/[\\/]+$/, '').replace(/\.git$/i, '').split(/[\\/:]/).pop();
  return name || null;
}

/** Folder name of a path, ignoring trailing separators. */
function folderName(p) {
  return path.basename((p || '').replace(/[\\/]+$/, '')) || null;
}

/**
 * Project name for a session: git remote (origin) repo name, else the git root folder name,
 * else the cwd folder name. `runGit` is injectable for tests.
 */
function resolveProject(cwd, runGit = git) {
  if (!cwd) return 'unknown';
  const fromRemote = repoNameFromRemote(runGit(cwd, ['remote', 'get-url', 'origin']));
  if (fromRemote) return fromRemote;
  const fromRoot = folderName(runGit(cwd, ['rev-parse', '--show-toplevel']));
  if (fromRoot) return fromRoot;
  return folderName(cwd) || 'unknown';
}

module.exports = { resolveProject, repoNameFromRemote, folderName };

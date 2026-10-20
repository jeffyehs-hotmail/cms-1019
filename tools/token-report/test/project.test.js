'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveProject, repoNameFromRemote } = require('../lib/project');

test('repoNameFromRemote handles https, ssh and trailing slashes', () => {
  assert.equal(repoNameFromRemote('https://github.com/jeffyehs-hotmail/cms-1019.git'), 'cms-1019');
  assert.equal(repoNameFromRemote('git@github.com:org/My.Repo.git\n'), 'My.Repo');
  assert.equal(repoNameFromRemote('https://dev.azure.com/org/proj/_git/app/'), 'app');
  assert.equal(repoNameFromRemote(''), null);
});

const fakeGit = (answers) => (cwd, args) => answers[args.join(' ')] || '';

test('resolveProject prefers the origin remote repo name', () => {
  const git = fakeGit({ 'remote get-url origin': 'https://github.com/o/cms-1019.git', 'rev-parse --show-toplevel': 'C:/x/cms' });
  assert.equal(resolveProject('C:\\x\\cms\\src', git), 'cms-1019');
});

test('resolveProject falls back to the git root folder, then the cwd folder', () => {
  assert.equal(resolveProject('C:\\x\\cms\\src', fakeGit({ 'rev-parse --show-toplevel': 'C:/x/cms' })), 'cms');
  assert.equal(resolveProject('C:\\x\\scratch\\', fakeGit({})), 'scratch');
  assert.equal(resolveProject(null, fakeGit({})), 'unknown');
});

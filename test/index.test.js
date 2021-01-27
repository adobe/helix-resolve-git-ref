/*
 * Copyright 2019 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

/* eslint-env mocha */

'use strict';

process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';

const assert = require('assert');
const path = require('path');
const querystring = require('querystring');

const NodeHttpAdapter = require('@pollyjs/adapter-node-http');
const FSPersister = require('@pollyjs/persister-fs');
const { setupMocha: setupPolly } = require('@pollyjs/core');
const nock = require('nock');
const { fetch, reset } = require('@adobe/helix-fetch').context({ alpnProtocols: ['http/1.1'] });
const pkgJson = require('../package.json');

const OWNER = 'adobe';
const REPO = 'helix-resolve-git-ref';
const PRIVATE_REPO = 'project-helix';
const SHORT_REF = 'main';
const FULL_REF = 'refs/heads/main';

const index = require('../src/index.js');

function main(params, headers = {}, context = {}) {
  if (!context.env) {
    context.env = {};
  }
  // emulate universal api
  return index.main({
    url: `https://www.dummy.com/resolve?${querystring.stringify(params)}`,
    headers: new Map(Object.entries(headers)),
  }, context);
}

/**
 * Checks if the specified string is a valid SHA-1 value.
 *
 * @param {string} str
 * @returns {boolean} `true` if `str` represents a valid SHA-1, otherwise `false`
 */
function isValidSha(str) {
  if (typeof str === 'string' && str.length === 40) {
    const res = str.match(/[0-9a-f]/g);
    return res && res.length === 40;
  }
  return false;
}

describe('main tests', () => {
  setupPolly({
    recordFailedRequests: false,
    recordIfMissing: false,
    matchRequestsBy: {
      headers: {
        exclude: ['authorization', 'User-Agent'],
      },
    },
    logging: false,
    adapters: [NodeHttpAdapter],
    persister: FSPersister,
    persisterOptions: {
      fs: {
        recordingsDir: path.resolve(__dirname, 'fixtures/recordings'),
      },
    },
  });

  it('main function is present', () => {
    assert(typeof main === 'function');
  });

  it('main function returns an object', async () => {
    const result = await main({});
    assert.equal(typeof result, 'object');
  });

  it('main function returns 400 for missing owner param', async () => {
    const { status } = await main({ repo: REPO, ref: SHORT_REF });
    assert.equal(status, 400);
  });

  it('main function returns 400 for missing repo param', async () => {
    const { status } = await main({ owner: OWNER, ref: SHORT_REF });
    assert.equal(status, 400);
  });

  it('ref param is optional (fallback: default branch)', async () => {
    const resp = await main({ owner: OWNER, repo: REPO });
    const { fqRef } = await resp.json();
    assert.equal(resp.status, 200);
    assert.equal(fqRef, 'refs/heads/main');
  });

  it('ref param is optional (fallback: default branch) for test repo', async () => {
    const resp = await main({ owner: 'trieloff', repo: 'test' });
    const { fqRef } = await resp.json();
    assert.equal(resp.status, 200);
    assert.equal(fqRef, 'refs/heads/main');
  });

  it('main function returns valid sha format', async () => {
    const resp = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    const { sha } = await resp.json();
    assert.equal(resp.status, 200);
    assert(isValidSha(sha));
  });

  it('main function supports short and full ref names', async () => {
    const resp1 = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    const resp2 = await main({ owner: OWNER, repo: REPO, ref: FULL_REF });
    const { sha: sha1 } = await resp1.json();
    const { sha: sha2 } = await resp2.json();
    assert.equal(sha1, sha2);
  });

  it('main function resolves tag', async () => {
    const ref = 'v1.0.0';
    let resp = await main({ owner: OWNER, repo: REPO, ref });
    const { fqRef, sha: sha1 } = await resp.json();
    assert.equal(fqRef, `refs/tags/${ref}`);
    resp = await main({ owner: OWNER, repo: REPO, ref: `refs/tags/${ref}` });
    const { sha: sha2 } = await resp.json();
    assert.equal(sha1, sha2);
  });

  it('main function returns correct sha', async () => {
    let resp = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    const { sha } = await resp.json();
    try {
      resp = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/branches/${SHORT_REF}`, { cache: 'no-store' });
      assert.ok(resp.ok);
      const { commit } = await resp.json();
      assert.ok(commit);
      assert.equal(commit.sha, sha);
    } finally {
      await reset();
    }
  });

  it('main function returns 404 for non-existing ref', async () => {
    const { status } = await main({ owner: OWNER, repo: REPO, ref: 'unknown' });
    assert.equal(status, 404);
  });

  it('main function returns 404 for non-existing repo', async () => {
    const { status } = await main({ owner: OWNER, repo: 'unknown', ref: SHORT_REF });
    assert.equal(status, 404);
  });

  it('main() works with private GitHub repo (gh token via header)', async () => {
    const resp = await main({
      owner: OWNER,
      repo: PRIVATE_REPO,
      ref: SHORT_REF,
    }, {
      'x-github-token': 'undisclosed-github-token',
    });
    const { fqRef } = await resp.json();
    assert.equal(resp.status, 200);
    assert.equal(fqRef, FULL_REF);
  });

  it('main() works with private GitHub repo (gh token via param)', async () => {
    const resp = await main({
      owner: OWNER,
      repo: PRIVATE_REPO,
      ref: SHORT_REF,
      GITHUB_TOKEN: 'undisclosed-github-token',
    });
    const { fqRef } = await resp.json();
    assert.equal(resp.status, 200);
    assert.equal(fqRef, FULL_REF);
  });

  it('main() works with private GitHub repo (gh token via env)', async () => {
    const resp = await main({
      owner: OWNER,
      repo: PRIVATE_REPO,
      ref: SHORT_REF,
    }, {}, {
      env: {
        GITHUB_TOKEN: 'undisclosed-github-token',
      },
    });
    const { fqRef } = await resp.json();
    assert.equal(resp.status, 200);
    assert.equal(fqRef, FULL_REF);
  });

  it('main() with path /_status_check/healthcheck.json reports status', async () => {
    const resp = await main({}, {}, {
      pathInfo: {
        suffix: '/_status_check/healthcheck.json',
      },
    });
    assert.equal(resp.status, 200);
    const result = await resp.json();

    assert.ok(result.github);
    delete result.github;
    assert.ok(result.response_time);
    delete result.response_time;
    delete result.process;
    assert.deepEqual(result, {
      status: 'OK',
      version: pkgJson.version,
    });
  });

  // eslint-disable-next-line func-names
  it('main function returns 502 for 5xx github server errors', async function () {
    const { server } = this.polly;
    server.host('https://github.com', () => {
      server.get('*').intercept((req, res) => {
        res.status(599);
      });
    });

    const { status } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    assert.equal(status, 502);
  });
});

describe('network/server error tests', () => {
  it('main function returns 503 for network errors', async () => {
    // nock is also used by PollyJS under the hood.
    // In order to avoid unwanted side effects we have to reset nock.
    nock.cleanAll();
    nock.restore();
    nock.activate();

    // simulate network problem
    nock.disableNetConnect();
    try {
      const { status } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
      assert.equal(status, 503);
    } finally {
      nock.cleanAll();
      nock.enableNetConnect();
    }
  });
});

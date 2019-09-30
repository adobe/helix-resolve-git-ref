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

const assert = require('assert');
const path = require('path');

const NodeHttpAdapter = require('@pollyjs/adapter-node-http');
const FSPersister = require('@pollyjs/persister-fs');
const { setupMocha: setupPolly } = require('@pollyjs/core');
const nock = require('nock');
const rp = require('request-promise-native');
const proxyquire = require('proxyquire');
const bunyan = require('bunyan');

const OWNER = 'adobe';
const REPO = 'helix-cli';
const PRIVATE_REPO = 'project-helix';
const SHORT_REF = 'master';
const FULL_REF = 'refs/heads/master';

const { main } = proxyquire('../src/index.js', {
  epsagon: {
    openWhiskWrapper(action) {
      return (params) => action(params);
    },
  },
});

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

  it('main function returns 404 for missing owner param', async () => {
    const { statusCode } = await main({ repo: REPO, ref: SHORT_REF });
    assert.equal(statusCode, 400);
  });

  it('main function returns 404 for missing repo param', async () => {
    const { statusCode } = await main({ owner: OWNER, ref: SHORT_REF });
    assert.equal(statusCode, 400);
  });

  it('ref param is optional with default: master', async () => {
    const { statusCode, body: { fqRef } } = await main({ owner: OWNER, repo: REPO });
    assert.equal(statusCode, 200);
    assert.equal(fqRef, 'refs/heads/master');
  });

  it('main function returns valid sha format', async () => {
    const { statusCode, body: { sha } } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    assert.equal(statusCode, 200);
    assert(isValidSha(sha));
  });

  it('main function supports short and full ref names', async () => {
    const { body: { sha: sha1 } } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    const { body: { sha: sha2 } } = await main({ owner: OWNER, repo: REPO, ref: FULL_REF });
    assert.equal(sha1, sha2);
  });

  it('main function resolves tag', async () => {
    const { body: { sha: sha1, fqRef } } = await main({ owner: OWNER, repo: REPO, ref: 'v1.0.0' });
    assert.equal(fqRef, 'refs/tags/v1.0.0');
    const { body: { sha: sha2 } } = await main({ owner: OWNER, repo: REPO, ref: 'refs/tags/v1.0.0' });
    assert.equal(sha1, sha2);
  });

  it('main function returns correct sha', async () => {
    const { body: { sha } } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    const options = {
      uri: `https://api.github.com/repos/${OWNER}/${REPO}/branches/${SHORT_REF}`,
      headers: {
        'User-Agent': 'Request-Promise',
      },
      json: true,
    };
    const { commit } = await rp(options);
    assert.ok(commit);
    assert.equal(commit.sha, sha);
  });

  it('main function returns 404 for non-existing ref', async () => {
    const { statusCode } = await main({ owner: OWNER, repo: REPO, ref: 'unknown' });
    assert.equal(statusCode, 404);
  });

  it('main function returns 404 for non-existing repo', async () => {
    const { statusCode } = await main({ owner: OWNER, repo: 'unknown', ref: SHORT_REF });
    assert.equal(statusCode, 404);
  });

  it('main() works with private GitHub repo (gh token via header)', async () => {
    const { statusCode, body: { fqRef } } = await main({
      owner: OWNER,
      repo: PRIVATE_REPO,
      ref: SHORT_REF,
      __ow_headers: { 'x-github-token': 'undisclosed-github-token' },
    });
    assert.equal(statusCode, 200);
    assert.equal(fqRef, FULL_REF);
  });

  it('main() works with private GitHub repo (gh token via param)', async () => {
    const { statusCode, body: { fqRef } } = await main({
      owner: OWNER,
      repo: PRIVATE_REPO,
      ref: SHORT_REF,
      GITHUB_TOKEN: 'undisclosed-github-token',
    });
    assert.equal(statusCode, 200);
    assert.equal(fqRef, FULL_REF);
  });

  it('main() with path /_status_check/pingdom.xml reports status', async () => {
    const res = await main({ __ow_method: 'get', __ow_path: '/_status_check/pingdom.xml' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.split('\n')[0], '<pingdom_http_custom_check><status>OK</status>');
  });

  it('index function instruments epsagon', async () => {
    const logger = bunyan.createLogger({
      name: 'test-logger',
      streams: [{
        level: 'info',
        type: 'raw',
        stream: new bunyan.RingBuffer({ limit: 100 }),
      }],
    });
    await main({
      EPSAGON_TOKEN: 'foobar',
      __ow_logger: logger,
    }, logger);

    assert.strictEqual(logger.streams[0].stream.records[0].msg, 'instrumenting epsagon.');
  });

  // eslint-disable-next-line func-names
  it('main function returns 502 for 5xx github server errors', async function () {
    const { server } = this.polly;
    server.host('https://github.com', () => {
      server.get('*').intercept((req, res) => {
        res.status(599);
      });
    });

    const { statusCode } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
    assert.equal(statusCode, 502);
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
      const { statusCode } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
      assert.equal(statusCode, 503);
    } finally {
      nock.cleanAll();
      nock.enableNetConnect();
    }
  });
});

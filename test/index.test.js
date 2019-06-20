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
const rp = require('request-promise-native');
const nock = require('nock');
const { main } = require('../src/index.js');

const ORG = 'adobe';
const REPO = 'helix-cli';
const SHORT_REF = 'master';
const FULL_REF = 'refs/heads/master';

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
  it('main function is present', () => {
    assert(typeof main === 'function');
  });

  it('main function returns an object', async () => {
    const result = await main({});
    assert.equal(typeof result, 'object');
  });

  it('main function returns 404 for missing org param', async () => {
    const { statusCode } = await main({ repo: REPO, ref: SHORT_REF });
    assert.equal(statusCode, 400);
  });

  it('main function returns 404 for missing repo param', async () => {
    const { statusCode } = await main({ org: ORG, ref: SHORT_REF });
    assert.equal(statusCode, 400);
  });

  it('ref param is optional with default: master', async () => {
    const { statusCode, body: { fqRef } } = await main({ org: ORG, repo: REPO });
    assert.equal(statusCode, 200);
    assert.equal(fqRef, 'refs/heads/master');
  });

  it('main function returns valid sha format', async () => {
    const { statusCode, body: { sha } } = await main({ org: ORG, repo: REPO, ref: SHORT_REF });
    assert.equal(statusCode, 200);
    assert(isValidSha(sha));
  });

  it('main function support short and full ref names', async () => {
    const { body: { sha: sha1 } } = await main({ org: ORG, repo: REPO, ref: SHORT_REF });
    const { body: { sha: sha2 } } = await main({ org: ORG, repo: REPO, ref: FULL_REF });
    assert.equal(sha1, sha2);
  });

  it('main function resolves tag', async () => {
    const { body: { sha: sha1, fqRef } } = await main({ org: ORG, repo: REPO, ref: 'v1.0.0' });
    assert.equal(fqRef, 'refs/tags/v1.0.0');
    const { body: { sha: sha2 } } = await main({ org: ORG, repo: REPO, ref: 'refs/tags/v1.0.0' });
    assert.equal(sha1, sha2);
  });

  it('main function returns correct sha', async () => {
    const { body: { sha } } = await main({ org: ORG, repo: REPO, ref: SHORT_REF });
    const options = {
      uri: `https://api.github.com/repos/${ORG}/${REPO}/branches/${SHORT_REF}`,
      headers: {
        'User-Agent': 'Request-Promise',
      },
      json: true,
    };
    const { commit } = await rp(options);
    assert(commit && commit.sha === sha);
  });

  it('main function returns 404 for non-existing ref', async () => {
    const { statusCode } = await main({ org: ORG, repo: REPO, ref: 'unknown' });
    assert.equal(statusCode, 404);
  });

  it('main function fails for non-existing repo', async () => {
    const { statusCode } = await main({ org: ORG, repo: 'unknown', ref: SHORT_REF });
    assert([401, 404].includes(statusCode));
  });

  it('main function returns 503 for network errors', async () => {
    nock.disableNetConnect();
    try {
      const { statusCode } = await main({ org: ORG, repo: REPO, ref: SHORT_REF });
      assert.equal(statusCode, 503);
    } finally {
      // reset nock
      nock.cleanAll();
      nock.enableNetConnect();
    }
  });
});

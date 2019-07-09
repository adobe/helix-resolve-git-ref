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
const proxyquire = require('proxyquire');
const { Logger } = require('@adobe/helix-shared');

const OWNER = 'adobe';
const REPO = 'helix-cli';
const SHORT_REF = 'master';
const FULL_REF = 'refs/heads/master';


const { main } = proxyquire('../src/index.js', {
  epsagon: {
    openWhiskWrapper(action) {
      return params => action(params);
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

  it('main function support short and full ref names', async () => {
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
    assert(commit && commit.sha === sha);
  });

  it('main function returns 404 for non-existing ref', async () => {
    const { statusCode } = await main({ owner: OWNER, repo: REPO, ref: 'unknown' });
    assert.equal(statusCode, 404);
  });

  it('main function returns 404 for non-existing repo', async () => {
    const { statusCode } = await main({ owner: OWNER, repo: 'unknown', ref: SHORT_REF });
    assert.equal(statusCode, 404);
  });

  it('main function returns 503 for network errors', async () => {
    nock.disableNetConnect();
    try {
      const { statusCode } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
      assert.equal(statusCode, 503);
    } finally {
      // reset nock
      nock.cleanAll();
      nock.enableNetConnect();
    }
  });

  it('main function returns 502 for 5xx github server errors', async () => {
    nock('https://github.com')
      .get(/.*/)
      .reply(599);
    try {
      const { statusCode } = await main({ owner: OWNER, repo: REPO, ref: SHORT_REF });
      assert.equal(statusCode, 502);
    } finally {
      // reset nock
      nock.cleanAll();
    }
  });

  it('main() without parameters reports status', async () => {
    const res = await main({ __ow_method: 'get' });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.split('\n')[0], '<pingdom_http_custom_check>');
  });

  it('index function instruments epsagon', async () => {
    const logger = Logger.getTestLogger({
      // tune this for debugging
      level: 'info',
    });
    logger.fields = {}; // avoid errors during setup. test logger is winston, but we need bunyan.
    logger.flush = () => {};
    await main({
      EPSAGON_TOKEN: 'foobar',
    }, logger);

    const output = await logger.getOutput();
    assert.ok(output.indexOf('instrumenting epsagon.') >= 0);
  });

  it('error in main function is caught', async () => {
    const logger = Logger.getTestLogger({
      // tune this for debugging
      level: 'info',
    });
    logger.fields = {}; // avoid errors during setup. test logger is winston, but we need bunyan.
    logger.flush = () => {
      throw new Error('error during flush.');
    };
    const result = await main({}, logger);

    assert.deepEqual(result, {
      statusCode: 500,
    });
  });
});

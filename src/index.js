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

/* eslint-disable prefer-promise-reject-errors */

const https = require('https');

const { wrap: helixStatus } = require('@adobe/helix-status');
const { logger } = require('@adobe/openwhisk-action-logger');
const { wrap } = require('@adobe/openwhisk-action-utils');
const { epsagon } = require('@adobe/helix-epsagon');

const DEFAULT_BRANCH_RE = /symref=HEAD:(\S+)/;

/**
 * This is the main function. It resolves the specified reference to the corresponding
 * sha of the HEAD commit at `ref`.
 *
 * If the specified repository is private you have to provide a valid GitHub access token
 * either via `x-github-token` header or `GITHUB_TOKEN` action parameter.
 *
 * @param {Object} params The OpenWhisk parameters
 * @param {string} params.owner GitHub organization or user
 * @param {string} params.repo GitHub repository name
 * @param {string} [params.ref=<default branch>] git reference (branch or tag name)
 * @param {Object} params.__ow_headers The request headers of this web action invokation
 * @returns {Promise<object>} result
 * @returns {string} result.sha the sha of the HEAD commit at `ref`
 * @returns {string} result.fqRef the fully qualified name of `ref`
 *                                (e.g. `refs/heads/<branch>` or `refs/tags/<tag>`)
 */
function lookup(params) {
  const {
    owner,
    repo,
    ref,
    __ow_headers = {},
  } = params;

  const githubToken = params.GITHUB_TOKEN || __ow_headers['x-github-token'];

  return new Promise((resolve/* , reject */) => {
    if (!owner || !repo) {
      resolve({
        statusCode: 400,
        body: 'owner and repo are mandatory parameters',
      });
      return;
    }

    const options = {
      host: 'github.com',
      path: `/${owner}/${repo}.git/info/refs?service=git-upload-pack`,
    };
    if (githubToken) {
      // the git transfer protocol supports basic auth with any user name and the token as password
      options.auth = `any_user:${githubToken}`;
    }

    https.get(options, (res) => {
      const { statusCode, statusMessage } = res;
      if (statusCode !== 200) {
        // consume response data to free up memory
        res.resume();
        let status = 500;
        if (statusCode >= 400 && statusCode <= 499) {
          // not found
          status = 404;
        }
        if (statusCode >= 500 && statusCode <= 599) {
          // bad gateway
          status = 502;
        }
        resolve({
          statusCode: status,
          body: `failed to fetch git repo info (statusCode: ${statusCode}, statusMessage: ${statusMessage})`,
        });
        return;
      }
      res.setEncoding('utf8');
      const searchTerms = [];
      if (ref) {
        if (ref.startsWith('refs/')) {
          // full ref name (e.g. 'refs/tags/v0.1.2')
          searchTerms.push(ref);
        } else {
          // short ref name, potentially ambiguous (e.g. 'main', 'v0.1.2')
          searchTerms.push(`refs/heads/${ref}`);
          searchTerms.push(`refs/tags/${ref}`);
        }
      }
      let resolved = false;
      let truncatedLine = '';
      let initialChunk = true;
      const dataHandler = (chunk) => {
        const data = truncatedLine + chunk;
        const lines = data.split('\n');
        // remember last (truncated) line; will be '' if chunk ends with '\n'
        truncatedLine = lines.pop();
        /* istanbul ignore else */
        if (initialChunk) {
          if (!ref) {
            // extract default branch from 2nd protocol line
            searchTerms.push(lines[1].match(DEFAULT_BRANCH_RE)[1]);
          }
          initialChunk = false;
        }
        const result = lines.filter((row) => {
          const parts = row.split(' ');
          return parts.length === 2 && searchTerms.includes(parts[1]);
        }).map((row) => row.substr(4).split(' ')); // skip leading pkt-len (4 bytes) (https://git-scm.com/docs/protocol-common#_pkt_line_format)
        if (result.length) {
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
              sha: result[0][0],
              fqRef: result[0][1],
            },
          });
          resolved = true;
          res.off('data', dataHandler);
        }
      };
      res.on('data', dataHandler);
      res.on('end', () => {
        if (!resolved) {
          resolve({
            statusCode: 404,
            body: 'ref not found',
          });
        }
      });
    }).on('error', (e) => {
      // (temporary?) network issue
      resolve({
        statusCode: 503, // service unavailable
        body: `failed to fetch git repo info:\n${String(e.stack)}`,
      });
    });
  });
}

/**
 * Main function called by the openwhisk invoker.
 * @param params Action params
 * @returns {Promise<*>} The response
 */
module.exports.main = wrap(lookup)
  .with(epsagon)
  .with(helixStatus, { github: 'https://github.com/adobe/helix-resolve-git-ref.git/info/refs?service=git-upload-pack' })
  .with(logger.trace)
  .with(logger);

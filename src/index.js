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

const { wrap } = require('@adobe/helix-pingdom-status');
const { openWhiskWrapper } = require('epsagon');

/**
 * This is the main function. It resolves the specified reference to the corresponding
 * sha of the HEAD commit at `ref`.
 *
 * @param {string} owner GitHub organization or user
 * @param {string} repo GitHub repository name
 * @param {string} [ref=master] git reference (branch or tag name)
 * @returns {Promise<object>} result
 * @returns {string} result.sha the sha of the HEAD commit at `ref`
 * @returns {string} result.fqRef the fully qualified name of `ref`
 *                                (e.g. `refs/heads/<branch>` or `refs/tags/<tag>`)
 */
function main({ owner, repo, ref = 'master' }) {
  return new Promise((resolve/* , reject */) => {
    if (!owner || !repo) {
      resolve({
        statusCode: 400,
        body: 'owner and repo are mandatory parameters',
      });
      return;
    }

    https.get(`https://github.com/${owner}/${repo}.git/info/refs?service=git-upload-pack`, (res) => {
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
      if (ref.startsWith('refs/')) {
        // full ref name (e.g. 'refs/tags/v0.1.2')
        searchTerms.push(ref);
      } else {
        // short ref name, potentially ambiguous (e.g. 'master', 'v0.1.2')
        searchTerms.push(`refs/heads/${ref}`);
        searchTerms.push(`refs/tags/${ref}`);
      }
      let resolved = false;
      let truncatedLine = '';
      res.on('data', (chunk) => {
        if (resolved) {
          return;
        }
        const data = truncatedLine + chunk;
        const lines = data.split('\n');
        // remember last (truncated) line; will be '' if chunk ends with '\n'
        truncatedLine = lines.pop();
        const result = lines.filter((row) => {
          const parts = row.split(' ');
          return parts.length === 2 && searchTerms.includes(parts[1]);
        }).map(row => row.substr(4).split(' ')); // skip leading pkt-len (4 bytes) (https://git-scm.com/docs/protocol-common#_pkt_line_format)
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
        }
      });
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

module.exports.main = wrap(openWhiskWrapper(main, {
  token_param: 'EPSAGON_TOKEN',
  appName: 'Helix Services',
  metadataOnly: false, // Optional, send more trace data
}));

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

const {
  resolve: resolveRef,
  ResolveError,
  NetworkError,
} = require('@adobe/gh-resolve-ref');

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

  const token = params.GITHUB_TOKEN || __ow_headers['x-github-token'];

  return resolveRef({
    owner,
    repo,
    ref,
    token,
  })
    .then((result) => {
      if (result) {
        return {
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: result,
        };
      } else {
        return {
          statusCode: 404,
          body: 'ref not found',
        };
      }
    })
    .catch((err) => {
      if (err instanceof TypeError) {
        return {
          statusCode: 400,
          body: 'owner and repo are mandatory parameters',
        };
      } else if (err instanceof NetworkError) {
        // (temporary?) network issue
        return {
          statusCode: 503, // service unavailable
          body: `failed to fetch git repo info: ${err.message}`,
        };
      } else /* istanbul ignore next */ if (err instanceof ResolveError) {
        const { statusCode, message } = err;
        let status = 500;
        if (statusCode >= 500 && statusCode <= 599) {
          // bad gateway
          status = 502;
        } else /* istanbul ignore next */ if (statusCode === 404) {
          // repo not found
          status = 404;
        }
        return {
          statusCode: status,
          body: `failed to fetch git repo info (statusCode: ${statusCode}, message: ${message})`,
        };
      } else {
        /* istanbul ignore next */
        return {
          statusCode: 500,
          body: `failed to fetch git repo info: ${err})`,
        };
      }
    });
}

module.exports = lookup;

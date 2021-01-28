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

const { wrap: helixStatus } = require('@adobe/helix-status');
const { logger } = require('@adobe/openwhisk-action-logger');
const { wrap } = require('@adobe/openwhisk-action-utils');
const { Response } = require('@adobe/helix-fetch');
const lookup = require('./lookup.js');

async function main(req, context) {
  // TODO: query params are used a lot and should be context properties
  const url = new URL(req.url);
  const params = Array.from(url.searchParams.entries()).reduce((p, [key, value]) => {
    // eslint-disable-next-line no-param-reassign
    p[key] = value;
    return p;
  }, {});

  // augment token if missing
  if (!params.GITHUB_TOKEN) {
    params.GITHUB_TOKEN = context.env.GITHUB_TOKEN || req.headers.get('x-github-token');
  }
  const result = await lookup(params);
  return new Response(JSON.stringify(result.body), {
    headers: result.headers,
    status: result.statusCode,
  });
}

/**
 * Main function called by the openwhisk invoker.
 * @param params Action params
 * @returns {Promise<*>} The response
 */
module.exports.main = wrap(main)
  .with(helixStatus, { github: 'https://github.com/adobe/helix-resolve-git-ref.git/info/refs?service=git-upload-pack' })
  .with(logger.trace)
  .with(logger);

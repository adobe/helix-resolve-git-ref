/*
 * Copyright 2020 Adobe. All rights reserved.
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
/* eslint-disable no-unused-expressions */

const chai = require('chai');
const chaiHttp = require('chai-http');
const packjson = require('../package.json');
require('dotenv').config();

chai.use(chaiHttp);
const { expect } = chai;

function getbaseurl() {
  const package = 'helix-services';
  const name = packjson.name.replace('@adobe/helix-', '');
  let version = `${packjson.version}`;
  if (process.env.CI && process.env.CIRCLE_BUILD_NUM && process.env.CIRCLE_BRANCH !== 'main') {
    version = `ci${process.env.CIRCLE_BUILD_NUM}`;
  }
  return `/${package}/${name}_${version}`;
}

const HOST = `https://${process.env.HLX_AWS_API}.execute-api.${process.env.HLX_AWS_REGION}.amazonaws.com`;

describe('Post-Deploy Tests (AWS)', () => {
  before(function before() {
    if (!process.env.HLX_AWS_API || !process.env.HLX_AWS_REGION) {
      this.skip();
    }
  });

  it('correct sha is returned', async () => {
    let url;

    await chai
      .request(HOST)
      .get(`${getbaseurl()}?owner=adobe&repo=helix-resolve-git-ref&ref=v1.7.8`)
      .then((response) => {
        url = response.request.url;

        expect(response).to.have.status(200);
        expect(response).to.be.json;
      }).catch((e) => {
        e.message = `At ${url}\n      ${e.message}`;
        throw e;
      });
  }).timeout(10000);

  it('correct sha is returned when no ref has been set', async () => {
    let url;

    await chai
      .request(HOST)
      .get(`${getbaseurl()}?owner=trieloff&repo=test`)
      .then((response) => {
        url = response.request.url;

        expect(response).to.have.status(200);
        expect(response).to.be.json;
      }).catch((e) => {
        e.message = `At ${url}\n      ${e.message}`;
        throw e;
      });
  }).timeout(10000);
});

import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import fs from 'fs';
import nock from 'nock';
import path from 'path';

import { setupProbot, teardownProbot } from '../testHelpers';
import { labels } from '../../src/labels.js';

const installationPayload = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixtures', 'installation.created.json'),
    'utf-8',
  ),
);

const reposResponse = {
  repositories: [
    { owner: { login: 'owner1' }, name: 'repo1' },
    { owner: { login: 'owner2' }, name: 'repo2' },
  ],
};

describe('Probot installation Handlers', () => {
  let probot: any;

  beforeEach(() => {
    probot = setupProbot();
  });

  afterEach(() => {
    teardownProbot();
  });

  test('make sure labels exist', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          issues: 'write',
        },
      })
      .get('/installation/repositories')
      .query({ installation_id: 2 })
      .reply(200, reposResponse);

    for (const repo of reposResponse.repositories) {
      mock.get(`/repos/${repo.owner.login}/${repo.name}/labels`).reply(200, []);

      for (const label of Object.values(labels)) {
        const color = label.color.substring(1).toUpperCase();

        mock
          .post(
            `/repos/${repo.owner.login}/${repo.name}/labels`,
            (body: any) => {
              expect(body).toMatchObject({
                name: label.name,
                color: color,
              });
              return true;
            },
          )
          .reply(201);
      }
    }

    await probot.receive({
      name: 'installation',
      payload: installationPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('updates label color if it does not match', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          issues: 'write',
        },
      })
      .get('/installation/repositories')
      .query({ installation_id: 2 })
      .reply(200, reposResponse);

    for (const repo of reposResponse.repositories) {
      const existingLabels = Object.values(labels).map(label => ({
        name: label.name,
        color: '000000',
      }));

      mock
        .get(`/repos/${repo.owner.login}/${repo.name}/labels`)
        .reply(200, existingLabels);

      for (const label of Object.values(labels)) {
        const color = label.color.substring(1).toUpperCase();

        mock
          .patch(
            `/repos/${repo.owner.login}/${repo.name}/labels/${encodeURIComponent(label.name)}`,
            (body: any) => {
              expect(body).toMatchObject({
                color,
              });
              return true;
            },
          )
          .reply(200);
      }
    }

    await probot.receive({
      name: 'installation',
      payload: installationPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });
});

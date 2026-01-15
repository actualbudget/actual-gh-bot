import { describe, afterEach, test, expect } from 'vitest';
import nock from 'nock';

import { setupProbot, teardownProbot } from '../testHelpers';
import { labels } from '../../src/labels.js';

const checkSuitePayload = {
  action: 'completed',
  check_suite: {
    head_sha: 'abc123',
    pull_requests: [{ number: 1 }],
  },
  repository: {
    name: 'your-repo-name',
    owner: {
      login: 'your-repo',
    },
  },
  installation: {
    id: 2,
  },
};

const pullRequestResponse = {
  number: 1,
  title: 'Test Pull Request',
  state: 'open',
  draft: false,
  user: {
    login: 'pr-author',
    id: 456,
  },
  head: {
    sha: 'abc123',
  },
  base: {
    ref: 'master',
  },
  labels: [],
};

describe('Probot Check Suite Handler', () => {
  let probot: any;

  afterEach(() => {
    teardownProbot();
  });

  test('adds failing CI label when a check run fails', async () => {
    probot = setupProbot({
      checkSuites: [{ id: 101 }],
      checkRunsBySuite: { 101: [{ conclusion: 'failure' }] },
    });

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/repos/your-repo/your-repo-name/pulls/1')
      .reply(200, pullRequestResponse)
      .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
      .reply(200, [])
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.failingCI.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'check_suite',
      payload: checkSuitePayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('sets ready for review when CI passes and no reviews', async () => {
    probot = setupProbot({
      checkSuites: [{ id: 101 }],
      checkRunsBySuite: { 101: [{ conclusion: 'success' }] },
    });

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/repos/your-repo/your-repo-name/pulls/1')
      .reply(200, pullRequestResponse)
      .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
      .reply(200, [])
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.readyForReview.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'check_suite',
      payload: checkSuitePayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });
});

import { describe, afterEach, test, expect } from 'vitest';
import nock from 'nock';

import { setupProbot, teardownProbot } from '../testHelpers';
import { labels } from '../../src/labels.js';

const checkSuitePayload = {
  action: 'completed',
  check_suite: {
    head_sha: 'abc123',
    // GitHub sends an empty list for PRs opened from forks
    pull_requests: [],
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
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [pullRequestResponse])
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
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [pullRequestResponse])
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

  test('ignores a failure once the same workflow has run again', async () => {
    probot = setupProbot({
      checkSuites: [{ id: 102 }, { id: 101 }],
      checkRunsBySuite: {
        101: [{ name: 'Check PR description', conclusion: 'failure' }],
        102: [
          { name: 'Check PR description', conclusion: 'success' },
          { name: 'Summary', conclusion: 'success' },
        ],
      },
      workflowRuns: [
        {
          check_suite_id: 102,
          workflow_id: 7,
          event: 'pull_request_target',
          run_number: 2,
        },
        {
          check_suite_id: 101,
          workflow_id: 7,
          event: 'pull_request_target',
          run_number: 1,
        },
      ],
    });

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test', permissions: { pull_requests: 'write' } })
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [pullRequestResponse])
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

  test('keeps a failure when another workflow has the same job names', async () => {
    probot = setupProbot({
      checkSuites: [{ id: 101 }, { id: 102 }],
      checkRunsBySuite: {
        101: [{ name: 'build', conclusion: 'failure' }],
        102: [{ name: 'build', conclusion: 'success' }],
      },
      workflowRuns: [
        {
          check_suite_id: 101,
          workflow_id: 7,
          event: 'pull_request',
          run_number: 1,
        },
        {
          check_suite_id: 102,
          workflow_id: 8,
          event: 'pull_request',
          run_number: 1,
        },
      ],
    });

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test', permissions: { pull_requests: 'write' } })
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [pullRequestResponse])
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

  test('keeps a failure when the workflow ran again for a different event', async () => {
    probot = setupProbot({
      checkSuites: [{ id: 101 }, { id: 102 }],
      checkRunsBySuite: {
        101: [{ name: 'build', conclusion: 'failure' }],
        102: [{ name: 'build', conclusion: 'success' }],
      },
      workflowRuns: [
        {
          check_suite_id: 101,
          workflow_id: 7,
          event: 'pull_request',
          run_number: 1,
        },
        {
          check_suite_id: 102,
          workflow_id: 7,
          event: 'workflow_dispatch',
          run_number: 2,
        },
      ],
    });

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test', permissions: { pull_requests: 'write' } })
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [pullRequestResponse])
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

  test('counts a failure in a check suite that is not from a workflow', async () => {
    probot = setupProbot({
      checkSuites: [{ id: 101 }, { id: 102 }],
      checkRunsBySuite: {
        101: [{ name: 'CodeRabbit', conclusion: 'failure' }],
        102: [{ name: 'build', conclusion: 'success' }],
      },
      workflowRuns: [
        {
          check_suite_id: 102,
          workflow_id: 7,
          event: 'pull_request',
          run_number: 1,
        },
      ],
    });

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test', permissions: { pull_requests: 'write' } })
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [pullRequestResponse])
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

  test('labels every open PR that has the commit as its head', async () => {
    probot = setupProbot({
      checkSuites: [{ id: 101 }],
      checkRunsBySuite: { 101: [{ conclusion: 'failure' }] },
    });

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test', permissions: { pull_requests: 'write' } })
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [pullRequestResponse, { ...pullRequestResponse, number: 2 }]);

    for (const number of [1, 2]) {
      mock
        .get(`/repos/your-repo/your-repo-name/pulls/${number}/reviews`)
        .reply(200, [])
        .put(
          `/repos/your-repo/your-repo-name/issues/${number}/labels`,
          (body: any) => {
            expect(body).toMatchObject({ labels: [labels.failingCI.name] });
            return true;
          },
        )
        .reply(200);
    }

    await probot.receive({
      name: 'check_suite',
      payload: checkSuitePayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('ignores check suites for commits that are not a PR head', async () => {
    probot = setupProbot();

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test', permissions: { pull_requests: 'write' } })
      .get('/repos/your-repo/your-repo-name/pulls')
      .query({ state: 'open', per_page: 100 })
      .reply(200, [{ ...pullRequestResponse, head: { sha: 'newer456' } }]);

    await probot.receive({
      name: 'check_suite',
      payload: checkSuitePayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });
});

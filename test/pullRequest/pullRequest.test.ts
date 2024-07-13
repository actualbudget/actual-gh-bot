import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import fs from 'fs';
import nock from 'nock';
import path from 'path';

import { setupProbot, teardownProbot } from '../testHelpers';
import { labels } from '../../src/labels.js';

const pullRequestPayload = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixtures/pull_request.json'),
    'utf-8',
  ),
);

const createPayload = (action: string, overrides = {}) => ({
  ...pullRequestPayload,
  action,
  ...overrides,
});

describe('Probot Pull Request Handlers', () => {
  let probot: any;

  beforeEach(() => {
    probot = setupProbot();
  });

  afterEach(() => {
    teardownProbot();
  });

  test('adds WIP prefix and label when PR opened', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .patch('/repos/your-repo/your-repo-name/pulls/1', (body: any) => {
        expect(body).toMatchObject({ title: '[WIP] Test Pull Request' });
        return true;
      })
      .reply(200)
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.wip.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('opened'),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('do not add WIP prefix if already present', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.wip.name] });
        return true;
      })
      .reply(200);

    const errorMock = nock('https://api.github.com')
      .patch('/repos/your-repo/your-repo-name/pulls/1')
      .reply(() => {
        throw new Error(
          'Title update should not be called for new pull requests already containing WIP prefix',
        );
      });

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('opened', {
        pull_request: {
          ...pullRequestPayload.pull_request,
          title: `[WIP] ${pullRequestPayload.pull_request.title}`,
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
    expect(errorMock.isDone()).toBe(false);
  });

  test('adds WIP prefix and label when PR reopened', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .patch('/repos/your-repo/your-repo-name/pulls/1', (body: any) => {
        expect(body).toMatchObject({ title: '[WIP] Test Pull Request' });
        return true;
      })
      .reply(200)
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.wip.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('reopened'),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('adds WIP label when title edited to include prefix', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      });

    const prefixes = ['[WIP] ', '[WIP]', 'WIP: ', 'WIP:', 'WIP '];

    for (const prefix of prefixes) {
      mock
        .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
          expect(body).toMatchObject({ labels: [labels.wip.name] });
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: createPayload('edited', {
          pull_request: {
            ...pullRequestPayload.pull_request,
            title: `${prefix}Test`,
          },
        }),
      });
    }

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('adds RFR label when title edited to remove prefix', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.readyForReview.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('edited', {
        pull_request: {
          ...pullRequestPayload.pull_request,
          title: 'Test',
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('ignore title edit when draft', async () => {
    const errorMock = nock('https://api.github.com')
      .put('/repos/your-repo/your-repo-name/issues/1/labels')
      .reply(() => {
        throw new Error(
          'Label update should not be called for draft pull requests',
        );
      });

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('edited', {
        pull_request: {
          ...pullRequestPayload.pull_request,
          draft: true,
        },
      }),
    });

    // Ensure that no label update request was made
    expect(errorMock.isDone()).toBe(false);
  });

  test('updates review status label for pull request synchronize event', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
      .reply(200, [{ state: 'APPROVED' }])
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.readyForReview.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('synchronize'),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('adds merged label when PR merged', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.merged.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('closed', {
        pull_request: {
          ...pullRequestPayload.pull_request,
          merged: true,
          merged_at: new Date().toISOString(),
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('clears labels when PR closed', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('closed', {
        pull_request: {
          ...pullRequestPayload.pull_request,
          merged: false,
          merged_at: null,
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('adds WIP label when pull request converted to draft', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.wip.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('converted_to_draft'),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('removes WIP prefix and adds RFR label for when draft converted', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .patch('/repos/your-repo/your-repo-name/pulls/1', (body: any) => {
        expect(body).toMatchObject({ title: 'Test Pull Request' });
        return true;
      })
      .reply(200)
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.readyForReview.name] });
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('ready_for_review', {
        pull_request: {
          ...pullRequestPayload.pull_request,
          title: '[WIP] Test Pull Request',
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });
});

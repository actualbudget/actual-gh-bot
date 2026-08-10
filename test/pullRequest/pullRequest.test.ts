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

const createPayload = (action: string, overrides: Record<string, any> = {}) => {
  const basePayload = JSON.parse(JSON.stringify(pullRequestPayload));
  const overridePullRequest = overrides.pull_request ?? {};

  return {
    ...basePayload,
    action,
    ...overrides,
    pull_request: {
      ...basePayload.pull_request,
      ...overridePullRequest,
    },
  };
};

type MockReview = {
  commit_id: string;
  state: 'APPROVED' | 'CHANGES_REQUESTED';
  submitted_at: string;
  user: {
    id: number;
    login: string;
  };
};

const createReview = (
  user: MockReview['user'],
  state: MockReview['state'],
  submittedAt = '2026-01-13T18:18:19Z',
): MockReview => ({
  commit_id: 'abc123',
  state,
  submitted_at: submittedAt,
  user,
});

const mockReviewLabelUpdate = ({
  reviews,
  expectedLabel,
  requiredReviewCount,
}: {
  reviews: MockReview[];
  expectedLabel: string;
  requiredReviewCount?: number;
}) => {
  const mock = nock('https://api.github.com')
    .post('/app/installations/2/access_tokens')
    .reply(200, {
      token: 'test',
      permissions: {
        pull_requests: 'write',
      },
    })
    .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
    .reply(200, reviews);

  const reviewers = new Map(
    reviews.map(review => [review.user.id, review.user]),
  );
  for (const reviewer of reviewers.values()) {
    mock
      .get(
        `/repos/your-repo/your-repo-name/collaborators/${reviewer.login}/permission`,
      )
      .reply(200, {
        permission: 'write',
        user: reviewer,
      });
  }

  if (requiredReviewCount !== undefined) {
    mock
      .get('/repos/your-repo/your-repo-name/branches/master/protection')
      .reply(200, {
        required_pull_request_reviews: {
          required_approving_review_count: requiredReviewCount,
        },
      });
  }

  mock
    .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
      expect(body).toMatchObject({ labels: [expectedLabel] });
      return true;
    })
    .reply(200);

  return mock;
};

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

  test('does not add WIP prefix or label for dependabot PRs', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
      .reply(200, [])
      .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
        expect(body).toMatchObject({ labels: [labels.readyForReview.name] });
        return true;
      })
      .reply(200);

    const errorMock = nock('https://api.github.com')
      .patch('/repos/your-repo/your-repo-name/pulls/1')
      .reply(() => {
        throw new Error('Title update should not be called for dependabot PRs');
      });

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('opened', {
        pull_request: {
          title: 'Bump shell-quote from 1.8.3 to 1.8.4',
          user: {
            login: 'dependabot[bot]',
            id: 49699333,
          },
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
          changes: {
            title: {
              from: 'Test',
            },
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
      .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
      .reply(200, [])
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
        changes: {
          title: {
            from: '[WIP] Test',
          },
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

  test('does not count the Copilot task initiator approval', async () => {
    const taskInitiator = {
      id: 886567,
      login: 'task-initiator',
    };
    const mock = mockReviewLabelUpdate({
      reviews: [createReview(taskInitiator, 'APPROVED')],
      expectedLabel: labels.needsMoreApprovals.name,
      requiredReviewCount: 1,
    });

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('synchronize', {
        pull_request: {
          user: {
            id: 198982749,
            login: 'Copilot',
          },
          assignee: taskInitiator,
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('counts another maintainer approval on Copilot pull requests', async () => {
    const taskInitiator = {
      id: 886567,
      login: 'task-initiator',
    };
    const maintainer = {
      id: 81489167,
      login: 'maintainer',
    };
    const mock = mockReviewLabelUpdate({
      reviews: [
        createReview(taskInitiator, 'APPROVED'),
        createReview(maintainer, 'APPROVED'),
      ],
      expectedLabel: labels.approved.name,
      requiredReviewCount: 1,
    });

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('synchronize', {
        pull_request: {
          user: {
            id: 198982749,
            login: 'Copilot',
          },
          assignee: taskInitiator,
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('keeps change requests from the Copilot task initiator', async () => {
    const taskInitiator = {
      id: 886567,
      login: 'task-initiator',
    };
    const mock = mockReviewLabelUpdate({
      reviews: [createReview(taskInitiator, 'CHANGES_REQUESTED')],
      expectedLabel: labels.changesRequested.name,
    });

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('synchronize', {
        pull_request: {
          user: {
            id: 198982749,
            login: 'Copilot',
          },
          assignee: taskInitiator,
        },
      }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('counts primary assignee approvals on regular pull requests', async () => {
    const reviewer = {
      id: 81489167,
      login: 'maintainer',
    };
    const mock = mockReviewLabelUpdate({
      reviews: [createReview(reviewer, 'APPROVED')],
      expectedLabel: labels.approved.name,
      requiredReviewCount: 1,
    });

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('synchronize', {
        pull_request: {
          assignee: reviewer,
        },
      }),
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
          state: 'closed',
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
          state: 'closed',
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
      payload: createPayload('converted_to_draft', {
        pull_request: {
          ...pullRequestPayload.pull_request,
          draft: true,
        },
      }),
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
      .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
      .reply(200, [])
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

import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import fs from 'fs';
import nock from 'nock';
import path from 'path';

import { setupProbot, teardownProbot } from '../testHelpers';
import { labels } from '../../src/labels.js';

const reviewPayload = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixtures/pull_request_review.json'),
    'utf-8',
  ),
);

// The PR fixture's author is 'pr-author' (id 456) with head sha 'abc123'.
const createReviewPayload = (
  reviewUser: { login: string; id: number },
  prOverrides: Record<string, any> = {},
) => ({
  ...reviewPayload,
  review: { ...reviewPayload.review, user: reviewUser },
  pull_request: { ...reviewPayload.pull_request, ...prOverrides },
});

const copilotPrOverrides = {
  user: { login: 'Copilot', id: 198982749 },
  assignees: [{ login: 'task-initiator', id: 789 }],
};

const apiReview = (login: string, id: number, state: string) => ({
  state,
  commit_id: 'abc123',
  user: { login, id },
  submitted_at: '2026-01-13T18:18:20Z',
});

const mockReviewFlow = (
  reviewer: string,
  reviewerId: number,
  state: string,
  expectedLabel: string,
  checkOrgMembership: boolean,
) => {
  const mock = nock('https://api.github.com')
    .post('/app/installations/2/access_tokens')
    .reply(200, {
      token: 'test',
      permissions: {
        pull_requests: 'write',
      },
    });

  if (checkOrgMembership) {
    // Reviewer is not an org member: skips auto-assign, keeps the test
    // focused on label behavior. Reviewer permission is mocked separately.
    mock.get(`/orgs/actualbudget/members/${reviewer}`).reply(404);
  }

  mock
    .get('/repos/your-repo/your-repo-name/pulls/1/reviews')
    .reply(200, [apiReview(reviewer, reviewerId, state)])
    .get(`/repos/your-repo/your-repo-name/collaborators/${reviewer}/permission`)
    .reply(200, { permission: 'write', user: { id: reviewerId } })
    // Branch protection is intentionally not mocked: with net connect
    // disabled the request fails, getRequiredReviews catches it and returns
    // 0, keeping the tests focused on the author/initiator exclusion.
    .put('/repos/your-repo/your-repo-name/issues/1/labels', (body: any) => {
      expect(body).toMatchObject({ labels: [expectedLabel] });
      return true;
    })
    .reply(200);

  return mock;
};

describe('Pull Request Review Labels', () => {
  let probot: any;

  beforeEach(() => {
    probot = setupProbot();
  });

  afterEach(() => {
    teardownProbot();
  });

  test('does not add the approved label when the PR author approves their own PR', async () => {
    const mock = mockReviewFlow(
      'pr-author',
      456,
      'APPROVED',
      labels.readyForReview.name,
      false,
    );

    await probot.receive({
      name: 'pull_request_review',
      payload: createReviewPayload({ login: 'pr-author', id: 456 }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('adds the approved label when someone other than the author approves', async () => {
    const mock = mockReviewFlow(
      'maintainer-user',
      123,
      'APPROVED',
      labels.approved.name,
      true,
    );

    await probot.receive({
      name: 'pull_request_review',
      payload: createReviewPayload({ login: 'maintainer-user', id: 123 }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('adds the changes-requested label when someone other than the author requests changes', async () => {
    const mock = mockReviewFlow(
      'maintainer-user',
      123,
      'CHANGES_REQUESTED',
      labels.changesRequested.name,
      true,
    );

    await probot.receive({
      name: 'pull_request_review',
      payload: createReviewPayload({ login: 'maintainer-user', id: 123 }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('does not add the changes-requested label when only the author requested changes', async () => {
    const mock = mockReviewFlow(
      'pr-author',
      456,
      'CHANGES_REQUESTED',
      labels.readyForReview.name,
      false,
    );

    await probot.receive({
      name: 'pull_request_review',
      payload: createReviewPayload({ login: 'pr-author', id: 456 }),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('does not add the approved label when the Copilot task initiator approves a Copilot PR', async () => {
    const mock = mockReviewFlow(
      'task-initiator',
      789,
      'APPROVED',
      labels.readyForReview.name,
      true,
    );

    await probot.receive({
      name: 'pull_request_review',
      payload: createReviewPayload(
        { login: 'task-initiator', id: 789 },
        copilotPrOverrides,
      ),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('adds the approved label when another maintainer approves a Copilot PR', async () => {
    const mock = mockReviewFlow(
      'maintainer-user',
      123,
      'APPROVED',
      labels.approved.name,
      true,
    );

    await probot.receive({
      name: 'pull_request_review',
      payload: createReviewPayload(
        { login: 'maintainer-user', id: 123 },
        copilotPrOverrides,
      ),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('still counts the assignee approval on a human-authored PR', async () => {
    const mock = mockReviewFlow(
      'assignee-user',
      321,
      'APPROVED',
      labels.approved.name,
      true,
    );

    await probot.receive({
      name: 'pull_request_review',
      payload: createReviewPayload(
        { login: 'assignee-user', id: 321 },
        { assignees: [{ login: 'assignee-user', id: 321 }] },
      ),
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });
});

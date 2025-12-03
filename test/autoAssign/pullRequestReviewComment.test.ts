import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import fs from 'fs';
import nock from 'nock';
import path from 'path';

import { setupProbot, teardownProbot } from '../testHelpers';

const pullRequestReviewCommentPayload = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixtures/pull_request_review_comment.json'),
    'utf-8',
  ),
);

describe('Pull Request Review Comment Auto-Assign', () => {
  let probot: any;

  beforeEach(() => {
    probot = setupProbot();
  });

  afterEach(() => {
    teardownProbot();
  });

  test('assigns maintainer when they leave a line comment', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/orgs/actualbudget/members/maintainer-user')
      .reply(204)
      .post(
        '/repos/your-repo/your-repo-name/issues/1/assignees',
        (body: any) => {
          expect(body).toMatchObject({ assignees: ['maintainer-user'] });
          return true;
        },
      )
      .reply(200);

    await probot.receive({
      name: 'pull_request_review_comment',
      payload: pullRequestReviewCommentPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('does not assign non-maintainer when they leave a line comment', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/orgs/actualbudget/members/maintainer-user')
      .reply(404);

    const errorMock = nock('https://api.github.com')
      .post('/repos/your-repo/your-repo-name/issues/1/assignees')
      .reply(() => {
        throw new Error('Assignee should not be called for non-maintainers');
      });

    await probot.receive({
      name: 'pull_request_review_comment',
      payload: pullRequestReviewCommentPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
    expect(errorMock.isDone()).toBe(false);
  });
});

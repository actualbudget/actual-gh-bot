import { describe, beforeEach, afterEach, test, expect } from 'vitest';
import fs from 'fs';
import nock from 'nock';
import path from 'path';

import { setupProbot, teardownProbot } from '../testHelpers';

const issueCommentPayload = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixtures/issue_comment.json'),
    'utf-8',
  ),
);

const pullRequestPayload = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '../fixtures/pull_request.json'),
    'utf-8',
  ),
);

describe('Issue Comment Auto-Assign', () => {
  let probot: any;

  beforeEach(() => {
    probot = setupProbot();
  });

  afterEach(() => {
    teardownProbot();
  });

  test('assigns maintainer when they comment on a PR', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/repos/your-repo/your-repo-name/pulls/1')
      .reply(200, pullRequestPayload.pull_request)
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
      name: 'issue_comment',
      payload: issueCommentPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('does not assign non-maintainer when they comment on a PR', async () => {
    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/repos/your-repo/your-repo-name/pulls/1')
      .reply(200, pullRequestPayload.pull_request)
      .get('/orgs/actualbudget/members/maintainer-user')
      .reply(404);

    const errorMock = nock('https://api.github.com')
      .post('/repos/your-repo/your-repo-name/issues/1/assignees')
      .reply(() => {
        throw new Error('Assignee should not be called for non-maintainers');
      });

    await probot.receive({
      name: 'issue_comment',
      payload: issueCommentPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
    expect(errorMock.isDone()).toBe(false);
  });

  test('ignores comments on issues (not PRs)', async () => {
    const issueOnlyPayload = {
      ...issueCommentPayload,
      issue: {
        ...issueCommentPayload.issue,
        pull_request: undefined,
      },
    };

    const errorMock = nock('https://api.github.com')
      .get('/orgs/actualbudget/members/maintainer-user')
      .reply(() => {
        throw new Error('Org membership should not be checked for issues');
      });

    await probot.receive({
      name: 'issue_comment',
      payload: issueOnlyPayload,
    });

    expect(errorMock.isDone()).toBe(false);
  });

  test('does not assign commenter when they are the PR author', async () => {
    const prAuthorPayload = {
      ...issueCommentPayload,
      comment: {
        ...issueCommentPayload.comment,
        user: {
          login: 'pr-author',
          id: 456,
        },
      },
    };

    const mock = nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, {
        token: 'test',
        permissions: {
          pull_requests: 'write',
        },
      })
      .get('/repos/your-repo/your-repo-name/pulls/1')
      .reply(200, pullRequestPayload.pull_request);

    const errorMock = nock('https://api.github.com')
      .post('/repos/your-repo/your-repo-name/issues/1/assignees')
      .reply(() => {
        throw new Error('Assignee should not be called when commenter is PR author');
      });

    await probot.receive({
      name: 'issue_comment',
      payload: prAuthorPayload,
    });

    expect(mock.pendingMocks()).toStrictEqual([]);
    expect(errorMock.isDone()).toBe(false);
  });
});

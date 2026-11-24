import { describe, afterEach, test, expect } from 'vitest';
import fs from 'fs';
import nock from 'nock';
import path from 'path';

import { setupProbot, teardownProbot } from '../testHelpers';
import { QA_COMMENT_MARKER } from '../../src/qa.js';

const readFixture = (name: string) =>
  JSON.parse(
    fs.readFileSync(path.join(__dirname, '../fixtures', name), 'utf-8'),
  );

const pullRequestPayload = readFixture('pull_request.json');
const issueCommentPayload = readFixture('issue_comment.json');

const REPO = '/repos/your-repo/your-repo-name';
const WORKFLOW = `${REPO}/actions/workflows/pr-qa.yml`;

// A draft PR keeps the label handlers down to a single request.
const createPayload = (action: string, user = { login: 'pr-author' }) => ({
  ...pullRequestPayload,
  action,
  repository: { ...pullRequestPayload.repository, default_branch: 'master' },
  pull_request: { ...pullRequestPayload.pull_request, draft: true, user },
});

const mockGitHub = () =>
  nock('https://api.github.com')
    .post('/app/installations/2/access_tokens')
    .reply(200, { token: 'test', permissions: { pull_requests: 'write' } });

const mockLabels = () =>
  nock('https://api.github.com').put(`${REPO}/issues/1/labels`).reply(200);

const run = (id: number, status: string, display_title: string) => ({
  id,
  status,
  display_title,
});

describe('PR QA', () => {
  afterEach(() => {
    teardownProbot();
  });

  test('starts a QA session when a PR is opened', async () => {
    const probot = setupProbot({ enableQA: true });
    mockLabels();
    const mock = mockGitHub()
      .post(`${WORKFLOW}/dispatches`, (body: any) => {
        expect(body).toStrictEqual({
          ref: 'master',
          inputs: { pr_number: '1', head_sha: 'abc123' },
        });
        return true;
      })
      .reply(204);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('opened'),
    } as any);

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test.each([
    ['QA is disabled', false, { login: 'pr-author' }],
    ['the PR is from a bot', true, { login: 'dependabot[bot]', type: 'Bot' }],
  ])('does not start a QA session when %s', async (_, enableQA, user) => {
    const probot = setupProbot({ enableQA });
    mockLabels();
    nock('https://api.github.com')
      .get(`${REPO}/pulls/1/reviews`)
      .optionally()
      .reply(200, []);
    mockGitHub();
    const dispatch = nock('https://api.github.com')
      .post(`${WORKFLOW}/dispatches`)
      .reply(204);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('opened', user),
    } as any);

    expect(dispatch.isDone()).toBe(false);
  });

  test('restarts an active QA session when a commit is pushed', async () => {
    const probot = setupProbot({ enableQA: true });
    mockLabels();
    const mock = mockGitHub()
      .get(`${WORKFLOW}/runs`)
      .query({ event: 'workflow_dispatch', per_page: 100 })
      .reply(200, {
        workflow_runs: [
          run(10, 'in_progress', 'PR QA #1'),
          run(11, 'queued', 'PR QA #1'),
          run(12, 'completed', 'PR QA #1'),
          run(13, 'in_progress', 'PR QA #12'),
        ],
      })
      .post(`${REPO}/actions/runs/10/cancel`)
      .reply(202)
      .post(`${REPO}/actions/runs/11/cancel`)
      .reply(202)
      .post(`${WORKFLOW}/dispatches`)
      .reply(204);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('synchronize'),
    } as any);

    expect(mock.pendingMocks()).toStrictEqual([]);
  });

  test('does nothing on push when no QA session is active', async () => {
    const probot = setupProbot({ enableQA: true });
    mockLabels();
    mockGitHub()
      .get(`${WORKFLOW}/runs`)
      .query(true)
      .reply(200, { workflow_runs: [run(12, 'completed', 'PR QA #1')] });
    const dispatch = nock('https://api.github.com')
      .post(`${WORKFLOW}/dispatches`)
      .reply(204);

    await probot.receive({
      name: 'pull_request',
      payload: createPayload('synchronize'),
    } as any);

    expect(dispatch.isDone()).toBe(false);
  });

  const commentPayload = (body: string, type: string) => ({
    ...issueCommentPayload,
    comment: {
      ...issueCommentPayload.comment,
      id: 3,
      body,
      user: { login: 'github-actions[bot]', type },
    },
  });

  test('hides previous QA comments when a new one is posted', async () => {
    const probot = setupProbot();
    const qa = `${QA_COMMENT_MARKER}\nresults`;
    const bot = { __typename: 'Bot' };
    const node = (
      n: number,
      body: string,
      isMinimized: boolean,
      author: any,
    ) => ({
      id: `node-${n}`,
      databaseId: n,
      body,
      isMinimized,
      author,
    });
    const minimized: string[] = [];

    const mock = mockGitHub()
      .post('/graphql', (body: any) => body.query.includes('comments(last'))
      .reply(200, {
        data: {
          repository: {
            pullRequest: {
              comments: {
                nodes: [
                  node(1, qa, true, bot),
                  node(2, qa, false, bot),
                  node(3, qa, false, bot),
                  node(4, 'unrelated', false, bot),
                  node(5, qa, false, { __typename: 'User' }),
                ],
              },
            },
          },
        },
      })
      .post('/graphql', (body: any) => {
        minimized.push(body.variables.id);
        return body.query.includes('minimizeComment');
      })
      .reply(200, { data: { minimizeComment: { clientMutationId: null } } });

    await probot.receive({
      name: 'issue_comment',
      payload: commentPayload(qa, 'Bot'),
    } as any);

    expect(mock.pendingMocks()).toStrictEqual([]);
    expect(minimized).toStrictEqual(['node-2']);
  });

  test('ignores the QA marker in comments from users', async () => {
    const probot = setupProbot();
    mockGitHub()
      .get(`${REPO}/pulls/1`)
      .reply(200, pullRequestPayload.pull_request)
      .get('/orgs/actualbudget/members/github-actions%5Bbot%5D')
      .reply(404);
    const graphql = nock('https://api.github.com').post('/graphql').reply(200);

    await probot.receive({
      name: 'issue_comment',
      payload: commentPayload(QA_COMMENT_MARKER, 'User'),
    } as any);

    expect(graphql.isDone()).toBe(false);
  });
});

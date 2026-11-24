import { Context } from 'probot';

import { checkFeatureFlag, getQAWorkflow } from './config.js';

// QA result comments must contain this marker so the bot can recognise them.
export const QA_COMMENT_MARKER = '<!-- actual-bot-qa -->';

// The QA workflow must set `run-name` to this value: workflow_dispatch runs
// do not expose their inputs, so the title is how a run is tied to its PR.
export const qaRunTitle = (prNumber: number) => `PR QA #${prNumber}`;

type PRContext = Pick<Context, 'octokit' | 'config'> & {
  payload: {
    repository: {
      owner: { login: string };
      name: string;
      default_branch: string;
    };
    pull_request: {
      number: number;
      head: { sha: string };
      user: { type: string };
    };
  };
};

// context.repo() produces a union too complex for TypeScript on wide contexts.
const repoOf = (context: {
  payload: { repository: { owner: { login: string }; name: string } };
}) => ({
  owner: context.payload.repository.owner.login,
  repo: context.payload.repository.name,
});

async function getActiveRunIds(context: PRContext, workflow: string) {
  const title = qaRunTitle(context.payload.pull_request.number);

  // Only the most recent runs are checked; an active run is always recent.
  const { data } = await context.octokit.actions.listWorkflowRuns({
    ...repoOf(context),
    workflow_id: workflow,
    event: 'workflow_dispatch',
    per_page: 100,
  });

  return data.workflow_runs
    .filter(run => run.status !== 'completed' && run.display_title === title)
    .map(run => run.id);
}

async function dispatch(context: PRContext, workflow: string) {
  const pr = context.payload.pull_request;

  await context.octokit.actions.createWorkflowDispatch({
    ...repoOf(context),
    workflow_id: workflow,
    ref: context.payload.repository.default_branch,
    inputs: {
      pr_number: String(pr.number),
      head_sha: pr.head.sha,
    },
  });
}

export async function startQA(context: PRContext) {
  if (context.payload.pull_request.user.type === 'Bot') return;
  if (!(await checkFeatureFlag(context, 'enableQA'))) return;

  await dispatch(context, await getQAWorkflow(context));
}

// Replaces a QA session that is still working on an outdated commit. Does
// nothing when no session is active.
export async function restartActiveQA(context: PRContext) {
  if (!(await checkFeatureFlag(context, 'enableQA'))) return;

  const workflow = await getQAWorkflow(context);
  const runIds = await getActiveRunIds(context, workflow);
  if (!runIds.length) return;

  await Promise.all(
    runIds.map(run_id =>
      context.octokit.actions.cancelWorkflowRun({ ...repoOf(context), run_id }),
    ),
  );

  await dispatch(context, workflow);
}

type QAComment = {
  id: string;
  databaseId: number;
  body: string;
  isMinimized: boolean;
  author: { __typename: string } | null;
};

// Call when a comment is created: if it is a QA result, hides the older ones.
export async function hidePreviousQAComments(
  context: Context<'issue_comment.created'>,
) {
  const { comment, issue } = context.payload;

  if (!issue.pull_request) return;
  // Only bots post QA results; this stops users hiding them with the marker.
  if (comment.user?.type !== 'Bot') return;
  if (!comment.body.includes(QA_COMMENT_MARKER)) return;

  // ponytail: last 100 comments only; paginate if QA comments get buried deeper
  const result = await context.octokit.graphql<{
    repository: { pullRequest: { comments: { nodes: QAComment[] } } };
  }>(
    `query ($owner: String!, $repo: String!, $number: Int!) {
      repository(owner: $owner, name: $repo) {
        pullRequest(number: $number) {
          comments(last: 100) {
            nodes { id databaseId body isMinimized author { __typename } }
          }
        }
      }
    }`,
    { ...repoOf(context), number: issue.number },
  );

  const outdated = result.repository.pullRequest.comments.nodes.filter(
    c =>
      c.databaseId !== comment.id &&
      !c.isMinimized &&
      c.author?.__typename === 'Bot' &&
      c.body.includes(QA_COMMENT_MARKER),
  );

  for (const comment of outdated) {
    await context.octokit.graphql(
      `mutation ($id: ID!) {
        minimizeComment(input: { subjectId: $id, classifier: OUTDATED }) {
          clientMutationId
        }
      }`,
      { id: comment.id },
    );
  }
}

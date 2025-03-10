import { Context, Probot } from 'probot';
import { components } from '@octokit/openapi-types';

import { labels } from '../labels.js';
import PullRequest from '../classes/PullRequest.js';

type PullsListResponseData = components['schemas']['pull-request-simple'][];

export default (app: Probot) => {
  app.on(['pull_request.opened', 'pull_request.reopened'], async context => {
    const pr = new PullRequest(context);

    let title = pr.data.title;

    if (!pr.wip && !pr.data.draft) {
      title = `[WIP] ${title}`;
      await pr.setTitle(title);
    }

    await pr.addLabel('wip');
  });

  app.on(['pull_request.edited'], async context => {
    const pr = new PullRequest(context);

    if (pr.data.state === 'closed' || pr.data.draft) return;

    if (pr.wip) {
      await pr.addLabel('wip');
    } else {
      await pr.addLabel('readyForReview');
    }
  });

  app.on(['pull_request.synchronize'], async context => {
    const pr = new PullRequest(context);

    if (pr.wip || pr.data.draft) return;

    const reviewStatus = await pr.getReviewStatus();

    await pr.addLabel(reviewStatus);
  });

  app.on(['pull_request.closed'], async context => {
    const pr = new PullRequest(context);

    if (pr.data.merged_at !== null) {
      await pr.addLabel('merged');
    } else {
      await pr.clearLabels();
    }
  });

  app.on(['pull_request.converted_to_draft'], async context => {
    const pr = new PullRequest(context);
    await pr.addLabel('wip');
  });

  app.on(['pull_request.ready_for_review'], async context => {
    const pr = new PullRequest(context);

    const title = pr.data.title.replace(labels.wip.regex ?? '', '');
    await pr.setTitle(title);

    await pr.addLabel('readyForReview');
  });

  app.on('push', async context => {
    if (context.payload.ref !== 'refs/heads/master') return;

    const { owner, repo } = context.repo();

    const pullRequests = await getOpenPRsForBase(
      context,
      owner,
      repo,
      'master',
    );

    for (const prData of pullRequests) {
      const { mergeable_state } = prData as unknown as PullsListResponseData & {
        mergeable_state: string;
      };
      const isConflicted = mergeable_state === 'dirty';

      const pr = await PullRequest.getFromNumber(context, prData.number);
      const conflictLabel = pr.data.labels.find(
        l => l.name === labels.mergeConflict.name,
      );

      if (isConflicted && !conflictLabel) {
        await pr.addLabel('mergeConflict');
      } else if (!isConflicted && conflictLabel) {
        await pr.removeLabel(labels.mergeConflict.name);
      }
    }
  });
};

async function getOpenPRsForBase(
  context: Context,
  owner: string,
  repo: string,
  base: string,
): Promise<PullsListResponseData> {
  let allPRs: PullsListResponseData = [];
  let page = 1;
  let tryMore: boolean = true;

  while (tryMore) {
    const { data } = await context.octokit.pulls.list({
      owner,
      repo,
      state: 'open',
      base,
      per_page: 100,
      page,
    });

    if (data.length === 0) {
      tryMore = false;
      break;
    }

    allPRs = allPRs.concat(data);
    page++;
  }

  return allPRs as PullsListResponseData;
}

import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import { labels } from '../labels.js';
import { syncPullRequestLabels } from '../labels/labelCalculator.js';

export default (app: Probot) => {
  app.on(['pull_request.opened', 'pull_request.reopened'], async context => {
    const pr = new PullRequest(context);

    let title = pr.data.title;

    if (!pr.wip && !pr.data.draft) {
      title = `[WIP] ${title}`;
      await pr.setTitle(title);
    }

    await syncPullRequestLabels(context, pr);
  });

  app.on(['pull_request.edited'], async context => {
    const pr = new PullRequest(context);

    if (
      pr.data.state === 'closed' ||
      pr.data.draft ||
      // the previous title is set here if the title was updated
      // this screens out edits to the body
      context.payload.changes?.title?.from == null
    ) {
      return;
    }

    await syncPullRequestLabels(context, pr);
  });

  app.on(['pull_request.synchronize'], async context => {
    const pr = new PullRequest(context);

    await syncPullRequestLabels(context, pr);
  });

  app.on(['pull_request.closed'], async context => {
    const pr = new PullRequest(context);
    await syncPullRequestLabels(context, pr);
  });

  app.on(['pull_request.converted_to_draft'], async context => {
    const pr = new PullRequest(context);
    await syncPullRequestLabels(context, pr);
  });

  app.on(['pull_request.ready_for_review'], async context => {
    const pr = new PullRequest(context);

    const title = pr.data.title.replace(labels.wip.regex ?? '', '');
    await pr.setTitle(title);

    await syncPullRequestLabels(context, pr);
  });
};

import { Probot } from 'probot';

import { labels } from '../labels.js';
import PullRequest from '../classes/PullRequest.js';

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
};

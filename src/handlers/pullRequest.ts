import { Probot } from 'probot';
import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['pull_request.opened', 'pull_request.reopened'], async context => {
    const pr = new PullRequest(context);

    let title = pr.data.title;

    if (!pr.wip) {
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

  app.on(['pull_request.closed'], async context => {
    const pr = new PullRequest(context);

    if (pr.data.merged_at !== null) {
      await pr.addLabel('merged');
    } else {
      await pr.clearLabels();
    }
  });
};
import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['pull_request_review'], async context => {
    const pr = new PullRequest(context);

    if (pr.wip || pr.data.draft) return;

    const reviewStatus = await pr.getReviewStatus();

    await pr.addLabel(reviewStatus);
  });
};

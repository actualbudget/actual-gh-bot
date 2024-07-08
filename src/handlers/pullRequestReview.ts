import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['pull_request_review'], async context => {
    const pr = new PullRequest(context);
    const reviewStatus = await pr.getReviewStatus();

    if (!reviewStatus) return;

    await pr.addLabel(reviewStatus);
  });
};

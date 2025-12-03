import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['pull_request_review'], async context => {
    const pr = new PullRequest(context);

    // Auto-assign reviewer if they are an org member
    const reviewer = context.payload.review.user?.login;
    if (reviewer) {
      const isMember = await pr.isOrgMember(reviewer);
      if (isMember) {
        await pr.addAssignee(reviewer);
      }
    }

    if (pr.wip || pr.data.draft) return;

    const reviewStatus = await pr.getReviewStatus();

    await pr.addLabel(reviewStatus);
  });
};

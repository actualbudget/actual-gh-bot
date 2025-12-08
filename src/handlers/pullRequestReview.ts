import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['pull_request_review'], async context => {
    const pr = new PullRequest(context);

    // Auto-assign reviewer if they are an org member and not the PR author
    const reviewer = context.payload.review.user?.login;
    const prAuthor = pr.data.user?.login;
    if (reviewer && reviewer !== prAuthor) {
      const isMember = await pr.isOrgMember(reviewer);
      if (isMember) {
        try {
          await pr.addAssignee(reviewer);
        } catch {
          // Ignore errors - don't break review labeling if assignment fails
        }
      }
    }

    if (pr.wip || pr.data.draft) return;

    const reviewStatus = await pr.getReviewStatus();

    await pr.addLabel(reviewStatus);
  });
};

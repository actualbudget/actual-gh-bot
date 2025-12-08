import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['pull_request_review_comment.created'], async context => {
    const commenter = context.payload.comment.user?.login;
    if (!commenter) return;

    const pr = new PullRequest(context);

    // Don't auto-assign if the commenter is the PR author
    const prAuthor = pr.data.user?.login;
    if (commenter === prAuthor) return;

    const isMember = await pr.isOrgMember(commenter);
    if (!isMember) return;

    await pr.addAssignee(commenter);
  });
};

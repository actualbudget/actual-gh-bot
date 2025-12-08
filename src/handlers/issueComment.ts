import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['issue_comment.created'], async context => {
    // Only handle comments on pull requests (not issues)
    if (!context.payload.issue.pull_request) return;

    const commenter = context.payload.comment.user?.login;
    if (!commenter) return;

    const pr = await PullRequest.getFromNumber(
      context,
      context.payload.issue.number,
    );

    // Don't auto-assign if the commenter is the PR author
    const prAuthor = pr.data.user?.login;
    if (commenter === prAuthor) return;

    const isMember = await pr.isOrgMember(commenter);
    if (!isMember) return;

    await pr.addAssignee(commenter);
  });
};

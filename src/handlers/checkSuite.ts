import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import { syncPullRequestLabels } from '../labels/labelCalculator.js';

export default (app: Probot) => {
  app.on(['check_suite.completed'], async context => {
    const pr = await PullRequest.getFromHeadSha(
      context,
      context.payload.check_suite.head_sha,
    );
    // No open PR has this commit as its head (push to a branch, or a newer
    // commit has been pushed since): nothing to label.
    if (!pr) return;

    await syncPullRequestLabels(context, pr);
  });
};

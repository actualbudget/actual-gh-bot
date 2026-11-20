import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import { syncPullRequestLabels } from '../labels/labelCalculator.js';

export default (app: Probot) => {
  app.on(['check_suite.completed'], async context => {
    // Empty when no open PR has this commit as its head (push to a branch, or
    // a newer commit has been pushed since): nothing to label.
    const prs = await PullRequest.getAllFromHeadSha(
      context,
      context.payload.check_suite.head_sha,
    );

    for (const pr of prs) {
      await syncPullRequestLabels(context, pr);
    }
  });
};

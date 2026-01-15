import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import { syncPullRequestLabels } from '../labels/labelCalculator.js';

export default (app: Probot) => {
  app.on(['check_suite.completed'], async context => {
    const commitSha = context.payload.check_suite.head_sha;
    const prNum = context.payload.check_suite.pull_requests[0].number;

    const pr = await PullRequest.getFromNumber(context, prNum);
    await syncPullRequestLabels(context, pr, { failingCiSha: commitSha });
  });
};

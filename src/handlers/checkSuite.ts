import { Probot } from 'probot';

import { checkFeatureFlag } from '../config.js';
import PullRequest from '../classes/PullRequest.js';

export default (app: Probot) => {
  app.on(['check_suite.completed'], async context => {
    if (!(await checkFeatureFlag(context, 'enableFailingCI'))) return;

    const commitSha = context.payload.check_suite.head_sha;
    const prNum = context.payload.check_suite.pull_requests[0].number;

    const pr = await PullRequest.getFromNumber(context, prNum);

    if (pr.wip || pr.data.draft) return;

    const suites = (
      await context.octokit.checks.listSuitesForRef({
        owner: pr.owner,
        repo: pr.repo,
        ref: commitSha,
      })
    ).data.check_suites;

    const runs = [];
    for (const suite of suites) {
      const run = (
        await context.octokit.checks.listForSuite({
          owner: pr.owner,
          repo: pr.repo,
          check_suite_id: suite.id,
        })
      ).data.check_runs;

      runs.push(...run);
    }

    const failed = runs.some(r => r.conclusion === 'failure');

    if (failed) {
      await pr.addLabel('failingCI');
    } else {
      await pr.addLabel('readyForReview');
    }
  });
};

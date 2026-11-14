import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import { syncPullRequestLabels } from '../labels/labelCalculator.js';

export default (app: Probot) => {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronize',
      'pull_request.closed',
      'pull_request.converted_to_draft',
      'pull_request.ready_for_review',
    ],
    async context => {
      await syncPullRequestLabels(context, new PullRequest(context));
    },
  );
};

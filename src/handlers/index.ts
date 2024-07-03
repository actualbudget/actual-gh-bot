import { Probot } from 'probot';

import PullRequest from './pullRequest.js';
import PullRequestReview from './pullRequestReview.js';

export default (app: Probot) => {
  PullRequest(app);
  PullRequestReview(app);
};

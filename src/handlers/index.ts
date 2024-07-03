import { Probot } from 'probot';

import CheckSuite from './checkSuite.js';
import PullRequest from './pullRequest.js';
import PullRequestReview from './pullRequestReview.js';

export default (app: Probot) => {
  CheckSuite(app);
  PullRequest(app);
  PullRequestReview(app);
};

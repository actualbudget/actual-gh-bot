import { Probot } from 'probot';

import CheckSuite from './checkSuite.js';
import CheckRun from './checkRun.js';
import Installation from './installation.js';
import IssueComment from './issueComment.js';
import PullRequest from './pullRequest.js';
import PullRequestReview from './pullRequestReview.js';
import PullRequestReviewComment from './pullRequestReviewComment.js';

export default (app: Probot) => {
  CheckSuite(app);
  CheckRun(app);
  Installation(app);
  IssueComment(app);
  PullRequest(app);
  PullRequestReview(app);
  PullRequestReviewComment(app);
};

import { Probot } from 'probot';

import PullRequest from './pullRequest.js';

export default (app: Probot) => {
  PullRequest(app);
};

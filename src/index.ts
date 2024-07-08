import { Probot } from 'probot';

import Handlers from './handlers/index.js';

export default (app: Probot) => {
  /*
  // uncomment for information on all received webhooks
  app.onAny(async context => {
    app.log.info({
      event: context.name,
      payload: {
        ...context.payload,
        pull_request: {},
      },
    });
  });
  */

  app.log.info('probot loaded');
  Handlers(app);
};

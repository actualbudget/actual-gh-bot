import { Probot } from 'probot';

import Handlers from './handlers/index.js';

export default (app: Probot) => {
  //  app.onAny(async context => {
  //    app.log.info({
  //      event: context.name,
  //      payload: {
  //        ...context.payload,
  //        pull_request: {},
  //      },
  //    });
  //  });

  Handlers(app);
};

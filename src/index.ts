import { Probot } from 'probot';

import Handlers from './handlers/index.js';
import { labels } from './labels.js';

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

  app.on(
    ['pull_request', 'pull_request_review', 'check_suite'],
    async context => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;

      const existingLabels = (
        await context.octokit.issues.listLabelsForRepo({
          owner,
          repo,
        })
      ).data;

      for (const label of Object.values(labels)) {
        const existing = existingLabels.find(l => l.name === label.name);
        const color = label.color.substring(1).toUpperCase();

        if (!existing) {
          await context.octokit.issues.createLabel({
            owner,
            repo,
            name: label.name,
            color,
          });

          continue;
        }

        if (existing.color.toUpperCase() !== color) {
          await context.octokit.issues.updateLabel({
            owner,
            repo,
            name: label.name,
            color,
          });

          continue;
        }
      }
    },
  );

  Handlers(app);
};

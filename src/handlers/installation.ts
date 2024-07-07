import { Probot, ProbotOctokit } from 'probot';

import { labels } from '../labels.js';

const ensureLabelsExist = async (
  owner: string,
  repo: string,
  octokit: ProbotOctokit,
) => {
  const existingLabels = (
    await octokit.issues.listLabelsForRepo({
      owner,
      repo,
    })
  ).data;

  for (const label of Object.values(labels)) {
    const existing = existingLabels.find(l => l.name === label.name);
    const color = label.color.substring(1).toUpperCase();

    if (!existing) {
      await octokit.issues.createLabel({
        owner,
        repo,
        name: label.name,
        color,
      });

      continue;
    }

    if (existing.color.toUpperCase() !== color) {
      await octokit.issues.updateLabel({
        owner,
        repo,
        name: label.name,
        color,
      });

      continue;
    }
  }
};

export default (app: Probot) => {
  app.on(
    [
      'installation.created',
      'installation.new_permissions_accepted',
      'installation.unsuspend',
      'installation_repositories.added',
    ],
    async context => {
      const installationId = context.payload.installation.id;

      const repos =
        await context.octokit.apps.listReposAccessibleToInstallation({
          installation_id: installationId,
        });

      for (const r of repos.data.repositories) {
        await ensureLabelsExist(r.owner.login, r.name, context.octokit);
      }
    },
  );
};

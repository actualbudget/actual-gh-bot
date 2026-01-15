import { Context } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import { checkFeatureFlag } from '../config.js';
import { labels } from '../labels.js';

export type LabelKey = keyof typeof labels;

type LabelCalcOptions = {
  failingCiSha?: string;
};

export async function calculateRequiredLabels(
  pr: PullRequest,
  options: { includeFailingCI: boolean; failingCiSha?: string },
): Promise<LabelKey[]> {
  if (pr.data.state === 'closed') {
    if (pr.data.merged_at != null) return ['merged'];
    return [];
  }

  if (pr.data.draft || pr.wip) {
    return ['wip'];
  }

  const reviewStatus = await pr.getReviewStatus();

  if (options.includeFailingCI) {
    const hasFailure = await pr.hasFailingCI(options.failingCiSha);
    if (hasFailure) {
      if (reviewStatus === 'approved') {
        return ['approved', 'failingCI'];
      }
      return ['failingCI'];
    }
  }

  return [reviewStatus];
}

export async function syncPullRequestLabels(
  context: Context,
  pr: PullRequest,
  options: LabelCalcOptions = {},
) {
  const includeFailingCI = await checkFeatureFlag(context, 'enableFailingCI');
  const requiredLabels = await calculateRequiredLabels(pr, {
    includeFailingCI,
    failingCiSha: options.failingCiSha,
  });

  if (requiredLabels.length === 0) {
    await pr.clearLabels();
    return;
  }

  await pr.setLabelsByKeys(requiredLabels);
}

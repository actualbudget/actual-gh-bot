import { Context } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import { checkFeatureFlag } from '../config.js';
import { labels } from '../labels.js';

export type LabelKey = keyof typeof labels;

export async function calculateRequiredLabels(
  pr: PullRequest,
  options: { includeFailingCI: boolean },
): Promise<LabelKey[]> {
  if (pr.data.state === 'closed') {
    if (pr.data.merged_at != null) return ['merged'];
    return [];
  }

  if (!pr.isDependabot && (pr.data.draft || pr.wip)) {
    return ['wip'];
  }

  const reviewStatus = await pr.getReviewStatus();

  if (options.includeFailingCI) {
    const hasFailure = await pr.hasFailingCI();
    if (hasFailure) {
      if (reviewStatus === 'approved') {
        return ['approved', 'failingCI'];
      }
      return ['failingCI'];
    }
  }

  return [reviewStatus];
}

export async function syncPullRequestLabels(context: Context, pr: PullRequest) {
  const includeFailingCI = await checkFeatureFlag(context, 'enableFailingCI');
  const requiredLabels = await calculateRequiredLabels(pr, {
    includeFailingCI,
  });

  if (requiredLabels.length === 0) {
    await pr.clearLabels();
    return;
  }

  await pr.setLabelsByKeys(requiredLabels);
}

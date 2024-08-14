import { Context, ProbotOctokit } from 'probot';

import { labels } from '../labels.js';

type TContext = Context<'pull_request' | 'pull_request_review'>;
type ReviewStatus =
  | 'changesRequested'
  | 'needsMoreApprovals'
  | 'approved'
  | 'readyForReview';

type BarebonesContext = {
  octokit: ProbotOctokit;
  payload: {
    repository: {
      owner: {
        login: string;
      };
      name: string;
    };
    pull_request?: any;
  };
};

export default class PullRequest {
  owner: string;
  repo: string;
  branch: string;
  number: number;
  wip: boolean;
  data: TContext['payload']['pull_request'];
  octokit: ProbotOctokit;

  constructor(context: TContext | BarebonesContext) {
    this.octokit = context.octokit;

    this.owner = context.payload.repository.owner.login;
    this.repo = context.payload.repository.name;

    this.data = context.payload.pull_request;
    this.number = this.data.number;
    this.branch = this.data.base.ref;
    this.wip = labels.wip.regex?.test(this.data.title) ?? false;
  }

  static async getFromNumber(context: BarebonesContext, number: number) {
    const { data } = await context.octokit.pulls.get({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      pull_number: number,
    });

    return new PullRequest({
      ...context,
      payload: {
        ...context.payload,
        pull_request: data,
      },
    });
  }

  get additionalLabels() {
    const labelNames = Object.values(labels).map(l => l.name);
    return this.data.labels
      .map(l => l.name)
      .filter(name => !labelNames.includes(name));
  }

  async setTitle(title: string) {
    await this.octokit.pulls.update({
      owner: this.owner,
      repo: this.repo,
      pull_number: this.number,
      title,
    });
  }

  async addLabel<LKey extends keyof typeof labels>(name: LKey) {
    await this.octokit.issues.setLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.number,
      labels: [...this.additionalLabels, labels[name].name],
    });
  }

  async clearLabels() {
    await this.octokit.issues.setLabels({
      owner: this.owner,
      repo: this.repo,
      issue_number: this.number,
      labels: this.additionalLabels,
    });
  }

  async getRequiredReviews() {
    try {
      const { data } = await this.octokit.repos.getBranchProtection({
        owner: this.owner,
        repo: this.repo,
        branch: this.branch,
      });

      return (
        data.required_pull_request_reviews?.required_approving_review_count ?? 0
      );
    } catch {
      return 0;
    }
  }

  async getReviewStatus(): Promise<ReviewStatus> {
    const reviews = (
      await this.octokit.pulls.listReviews({
        owner: this.owner,
        repo: this.repo,
        pull_number: this.number,
      })
    ).data.filter(
      r =>
        r.commit_id === this.data.head.sha &&
        ['APPROVED', 'CHANGES_REQUESTED'].includes(r.state),
    );

    if (reviews.length < 1) return 'readyForReview';

    const latestReviewsObj: {
      [key: number]: {
        state: string;
        time: number;
        username: string;
        userId: number;
      };
    } = {};

    for (const r of reviews) {
      if (!r?.user?.id || !r.submitted_at) continue;

      const user = r.user.id;
      const time = new Date(r.submitted_at).getTime();

      const review = {
        state: r.state,
        username: r.user.login,
        userId: user,
        time,
      };

      if (!latestReviewsObj[user]) {
        latestReviewsObj[user] = review;
        continue;
      }

      if (latestReviewsObj[user].time < time) {
        latestReviewsObj[user] = review;
      }
    }

    const reviewerPermissions = await Promise.all(
      Object.values(latestReviewsObj).map(({ username }) =>
        this.octokit.repos.getCollaboratorPermissionLevel({
          owner: this.owner,
          repo: this.repo,
          username,
        }),
      ),
    );

    const pushReviewers = reviewerPermissions
      .filter(({ data }) => ['write', 'admin'].includes(data.permission))
      .map(d => d.data?.user?.id);

    const latestReviews = Object.values(latestReviewsObj).filter(({ userId }) =>
      pushReviewers.includes(userId),
    );

    if (!latestReviews.length) return 'readyForReview';

    if (latestReviews.filter(r => r.state === 'CHANGES_REQUESTED').length > 0) {
      return 'changesRequested';
    }

    const approvingReviews = latestReviews.filter(
      r => r.state === 'APPROVED',
    ).length;
    const requiredReviews = await this.getRequiredReviews();

    if (requiredReviews > approvingReviews) {
      return 'needsMoreApprovals';
    }

    if (approvingReviews > 0) {
      return 'approved';
    }

    return 'readyForReview';
  }
}

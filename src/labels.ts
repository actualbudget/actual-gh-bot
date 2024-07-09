type Label = {
  name: string;
  color: string;
  description: string;
  regex?: RegExp;
};

export const labels: Record<string, Label> = {
  wip: {
    regex: /^\s*(\[WIP\]\s*|WIP:\s*|WIP\s+)+/i,
    name: ':construction: WIP',
    color: '#FBCA04',
    description: 'Still under development, not yet ready for review',
  },
  readyForReview: {
    name: ':mag: Ready for review',
    color: '#334796',
    description: 'Ready for review',
  },
  approved: {
    name: ':white_check_mark: Approved',
    color: '#0E8A16',
    description: 'Has been reviewed, approved and is ready for merge',
  },
  changesRequested: {
    name: ':warning: Changes requested',
    color: '#AA2626',
    description: 'Has been reviewed, and changes have been requested',
  },
  needsMoreApprovals: {
    name: ':star2: Needs more approvals',
    color: '#96C823',
    description: 'Needs more approvals',
  },
  merged: {
    name: ':sparkles: Merged',
    color: '#6F42C1',
    description: 'Merged successfully',
  },
  failingCI: {
    name: ':x: Failing CI',
    color: '#F92F60',
    description:
      'There are failing checks that must be fixed before it can be reviewed',
  },
};

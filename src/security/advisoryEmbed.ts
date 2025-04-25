import type { components } from '@octokit/openapi-types';

const getColourForSeverity = (severity: string | null): number => {
  switch (severity) {
    case 'critical':
      return 0xff0000; // Red
    case 'high':
    case 'medium':
      return 0xff8c00; // Orange
    case 'low':
      return 0xffff66; // Yellow
    default:
      return 0xff8c00; // Orange for unknown
  }
};

export const advisoryEmbed = (
  payload:
    | components['schemas']['webhook-repository-advisory-reported']
    | components['schemas']['webhook-repository-advisory-published'],
) => {
  const { repository, repository_advisory, action, sender } = payload;

  const { owner, name: repoName, html_url } = repository;

  const {
    html_url: permalink,
    severity,
    summary,
    author,
  } = repository_advisory;

  const initiator = author || sender;

  return {
    title:
      action === 'reported' ? 'New Advisory Reported' : 'Advisory Published',
    url: permalink,
    description: summary,
    color: action === 'reported' ? getColourForSeverity(severity) : 0xd3d3d3, // Red for reported, grey for published
    fields: [
      {
        name: 'Action',
        value: action,
        inline: true,
      },
      {
        name: 'Repository',
        value: `[${owner.login}/${repoName}](${html_url})`,
        inline: true,
      },
      {
        name: 'Severity',
        value: severity || 'Unknown',
        inline: true,
      },
      {
        name: 'Initiator',
        value: initiator
          ? `[${initiator.login}](${initiator.html_url})`
          : 'Unknown',
        inline: true,
      },
    ],
    footer: {
      text: 'Repository Advisories',
    },
    timestamp: new Date().toISOString(),
  };
};

import type { components } from '@octokit/openapi-types';

const getColourForAction = (action: string): number => {
  switch (action) {
    case 'created':
      return 0xff0000; // Red
    case 'dismissed':
    case 'auto_dismissed':
      return 0xd3d3d3; // Light grey
    case 'fixed':
      return 0x00cc66; // Green
    case 'reintroduced':
      return 0xff8c00; // Orange
    case 'reopened':
    case 'auto_reopened':
      return 0xffff66; // Yellow
    default:
      return 0x808080; // Fallback grey
  }
};

const getTitleForAction = (action: string): string => {
  switch (action) {
    case 'created':
      return 'Dependabot Alert';
    case 'dismissed':
      return 'Dependabot Alert Dismissed';
    case 'auto_dismissed':
      return 'Dependabot Alert Automatically Dismissed';
    case 'fixed':
      return 'Dependabot Alert Fixed';
    case 'reintroduced':
      return 'Dependabot Alert Reintroduced';
    case 'reopened':
      return 'Dependabot Alert Reopened';
    case 'auto_reopened':
      return 'Dependabot Alert Automatically Reopened';
    default:
      return 'Dependabot Alert';
  }
};

export const dependabotEmbed = (
  payload:
    | components['schemas']['webhook-dependabot-alert-created']
    | components['schemas']['webhook-dependabot-alert-dismissed']
    | components['schemas']['webhook-dependabot-alert-auto-dismissed']
    | components['schemas']['webhook-dependabot-alert-fixed']
    | components['schemas']['webhook-dependabot-alert-reintroduced']
    | components['schemas']['webhook-dependabot-alert-reopened']
    | components['schemas']['webhook-dependabot-alert-auto-reopened'],
) => {
  const { repository, alert, action } = payload;

  const { owner, name: repoName, html_url } = repository;

  if (!alert || !alert.security_advisory) {
    console.warn('No alert or security_advisory in payload');
    return;
  }

  const {
    security_advisory: { severity, summary },
    html_url: permalink,
    dependency,
    dismissed_by,
  } = alert;

  const packageName = dependency?.package?.name;

  return {
    title: packageName
      ? `${getTitleForAction(action)}: ${packageName}`
      : getTitleForAction(action),
    url: permalink,
    description: summary,
    color: getColourForAction(action),
    fields: [
      {
        name: 'Action',
        value: action,
        inline: true,
      },
      {
        name: 'Dependency',
        value: packageName || 'Unknown',
        inline: true,
      },
      {
        name: 'Repository',
        value: `[${owner.login}/${repoName}](${html_url})`,
        inline: true,
      },
      {
        name: 'Severity',
        value: severity,
        inline: true,
      },
      action === 'dismissed'
        ? {
            name: 'Dismissed By',
            value: dismissed_by?.login || 'Unknown',
            inline: true,
          }
        : null,
    ].filter(Boolean),
    footer: {
      text: 'GitHub Dependabot',
    },
    timestamp: new Date().toISOString(),
  };
};

import PullRequest from '../classes/PullRequest.js';
import {
  BOT_BOUNDARY_MARKER,
  BOT_BOUNDARY_TEXT,
  buildSectionBlock,
  hasSection,
  upsertSection,
} from './prBodyHelpers.js';

export const NETLIFY_SECTION_KEY = 'netlify-previews';
export const NETLIFY_APP_SLUG = 'netlify';
export const NETLIFY_APP_NAME = 'Netlify';

export type PreviewLink = {
  name: string;
  url: string;
};

type NetlifySectionOptions = {
  insertBefore?: string;
};

export function isNetlifyApp(
  app: { slug?: string | null; name?: string | null } | null | undefined,
) {
  return app?.slug === NETLIFY_APP_SLUG || app?.name === NETLIFY_APP_NAME;
}

export function buildNetlifySectionBody(links: PreviewLink[] = []) {
  const lines = ['### Netlify Deploy Previews', ''];

  if (links.length === 0) {
    lines.push('Netlify deploy previews are not available yet.');
  } else {
    for (const link of links) {
      lines.push(`- ${link.name}: ${link.url}`);
    }
  }

  return lines.join('\n');
}

export function buildNetlifySectionBlock(links: PreviewLink[] = []) {
  return buildSectionBlock(NETLIFY_SECTION_KEY, buildNetlifySectionBody(links));
}

export async function ensureNetlifySection(
  pr: PullRequest,
  options: NetlifySectionOptions = {},
) {
  const currentBody = pr.data.body ?? '';
  if (hasSection(currentBody, NETLIFY_SECTION_KEY)) {
    return;
  }

  const block = buildNetlifySectionBlock();
  const nextBody = upsertSection(currentBody, block, {
    sectionKey: NETLIFY_SECTION_KEY,
    insertBefore: options.insertBefore,
    boundaryMarker: BOT_BOUNDARY_MARKER,
    boundaryText: BOT_BOUNDARY_TEXT,
  });

  if (nextBody !== currentBody) {
    await pr.setBody(nextBody);
  }
}

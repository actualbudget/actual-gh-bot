export const BOT_BOUNDARY_MARKER = '<!--- actual-bot-sections --->';
export const BOT_BOUNDARY_TEXT = `${BOT_BOUNDARY_MARKER}\n<hr />\n_Automated sections below_`;

export const BUNDLE_STATS_MARKER =
  '<!--- bundlestats-action-comment key:combined start --->';

type UpsertSectionOptions = {
  sectionKey: string;
  insertBefore?: string;
  boundaryMarker?: string;
  boundaryText?: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSectionMarkers(sectionKey: string) {
  return {
    start: `<!--- actual-pr-body-section key:${sectionKey} start --->`,
    end: `<!--- actual-pr-body-section key:${sectionKey} end --->`,
  };
}

function insertNewBlock(
  body: string,
  block: string,
  insertBefore: string | undefined,
  boundaryMarker: string | undefined,
  boundaryText: string | undefined,
) {
  const shouldAddBoundary =
    boundaryText && boundaryMarker && !body.includes(boundaryMarker);
  const withBoundary = shouldAddBoundary
    ? `${boundaryText}\n\n${block.trim()}`
    : block.trim();

  if (!body.trim()) {
    return withBoundary;
  }

  if (insertBefore) {
    const insertIndex = body.indexOf(insertBefore);
    if (insertIndex !== -1) {
      const prefix = body.slice(0, insertIndex);
      const suffix = body.slice(insertIndex);
      const separator = prefix.endsWith('\n') ? '\n' : '\n\n';
      const suffixSeparator = suffix.startsWith('\n') ? '' : '\n\n';
      return `${prefix}${separator}${withBoundary}${suffixSeparator}${suffix}`;
    }
  }

  const separator = body.endsWith('\n') ? '\n' : '\n\n';
  return `${body}${separator}${withBoundary}`;
}

export function buildSectionBlock(sectionKey: string, sectionBody: string) {
  const markers = getSectionMarkers(sectionKey);
  return [markers.start, sectionBody, '', markers.end, ''].join('\n');
}

export function hasSection(body: string, sectionKey: string) {
  const markers = getSectionMarkers(sectionKey);
  const blockPattern = new RegExp(
    `${escapeRegExp(markers.start)}[\\s\\S]*?${escapeRegExp(markers.end)}`,
    'm',
  );
  return blockPattern.test(body);
}

export function upsertSection(
  body: string,
  block: string,
  options: UpsertSectionOptions,
) {
  const markers = getSectionMarkers(options.sectionKey);
  const blockPattern = new RegExp(
    `${escapeRegExp(markers.start)}[\\s\\S]*?${escapeRegExp(markers.end)}`,
    'm',
  );

  if (blockPattern.test(body)) {
    return body.replace(blockPattern, block.trim());
  }

  return insertNewBlock(
    body,
    block,
    options.insertBefore,
    options.boundaryMarker,
    options.boundaryText,
  );
}

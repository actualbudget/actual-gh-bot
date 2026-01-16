import { Probot } from 'probot';

import PullRequest from '../classes/PullRequest.js';
import {
  BOT_BOUNDARY_MARKER,
  BOT_BOUNDARY_TEXT,
  BUNDLE_STATS_MARKER,
  buildSectionBlock,
  upsertSection,
} from '../utils/prBodyHelpers.js';
import {
  NETLIFY_SECTION_KEY,
  buildNetlifySectionBody,
  isNetlifyApp,
  type PreviewLink,
} from '../utils/netlifySections.js';

export default (app: Probot) => {
  app.on(['check_run.completed'], async context => {
    const { check_run: checkRun } = context.payload;

    if (!checkRun || !isNetlifyApp(checkRun.app)) {
      return;
    }

    const pullRequest = checkRun.pull_requests?.[0];
    if (!pullRequest) {
      return;
    }

    const { owner, repo } = context.repo();
    const headSha = checkRun.head_sha;

    const { data } = await context.octokit.checks.listForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });

    const netlifyRuns = data.check_runs.filter(run => isNetlifyApp(run.app));
    const seenNames = new Set<string>();
    const previewLinks: PreviewLink[] = [];

    for (const run of netlifyRuns) {
      const url = run.details_url ?? run.html_url;
      if (!url || seenNames.has(run.name)) {
        continue;
      }
      seenNames.add(run.name);
      previewLinks.push({ name: run.name, url });
    }

    previewLinks.sort((a, b) => a.name.localeCompare(b.name));

    const sectionBody = buildNetlifySectionBody(previewLinks);
    const block = buildSectionBlock(NETLIFY_SECTION_KEY, sectionBody);

    const pr = await PullRequest.getFromNumber(context, pullRequest.number);
    const currentBody = pr.data.body ?? '';
    const nextBody = upsertSection(currentBody, block, {
      sectionKey: NETLIFY_SECTION_KEY,
      insertBefore: BUNDLE_STATS_MARKER,
      boundaryMarker: BOT_BOUNDARY_MARKER,
      boundaryText: BOT_BOUNDARY_TEXT,
    });

    if (nextBody !== currentBody) {
      await pr.setBody(nextBody);
    }
  });
};

import { Probot, ProbotOctokit } from 'probot';
import nock from 'nock';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import myProbotApp from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const privateKey = fs.readFileSync(
  path.join(__dirname, 'fixtures/mock-cert.pem'),
  'utf-8',
);

type CheckSuite = {
  id: number;
};

type ConfigOptions = {
  enableFailingCI?: boolean;
  checkSuites?: CheckSuite[];
  checkRunsBySuite?: Record<number, unknown[]>;
};

export const mockConfig = ({ enableFailingCI = true }: ConfigOptions = {}) =>
  nock('https://api.github.com')
    .persist()
    .get('/repos/your-repo/your-repo-name/contents/.github%2Factual-gh-bot.yml')
    .reply(200, `featureFlags:\n  enableFailingCI: ${enableFailingCI}\n`);

export const mockCheckSuites = ({
  checkSuites = [],
  checkRunsBySuite = {},
}: Pick<ConfigOptions, 'checkSuites' | 'checkRunsBySuite'> = {}) => {
  nock('https://api.github.com')
    .persist()
    .get(/\/repos\/your-repo\/your-repo-name\/commits\/[^/]+\/check-suites/)
    .reply(200, { check_suites: checkSuites });

  for (const suite of checkSuites) {
    nock('https://api.github.com')
      .persist()
      .get(
        `/repos/your-repo/your-repo-name/check-suites/${suite.id}/check-runs`,
      )
      .reply(200, { check_runs: checkRunsBySuite[suite.id] ?? [] });
  }
};

export const setupProbot = (options: ConfigOptions = {}) => {
  nock.disableNetConnect();
  mockConfig(options);
  mockCheckSuites(options);
  const probot = new Probot({
    appId: 123,
    privateKey,
    Octokit: ProbotOctokit.defaults({
      retry: { enabled: false },
      throttle: { enabled: false },
    }),
  });
  probot.load(myProbotApp);
  return probot;
};

export const teardownProbot = () => {
  nock.cleanAll();
  nock.enableNetConnect();
};

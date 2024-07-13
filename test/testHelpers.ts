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

export const setupProbot = () => {
  nock.disableNetConnect();
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

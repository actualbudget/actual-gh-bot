import { createProbot } from 'probot';
import { Handler } from '@netlify/functions';
import type { WebhookEventName } from '@octokit/webhooks-types';
import app from '../../src/index';

const handler: Handler = async event => {
  const probot = createProbot();
  try {
    probot.log.info('loading app');
    await probot.load(app);

    const deliveryHeader = (event.headers['X-GitHub-Delivery'] ||
      event.headers['x-github-delivery']) as string;
    const nameHeader = (event.headers['X-GitHub-Event'] ||
      event.headers['x-github-event']) as WebhookEventName;
    const sigHeader = (event.headers['X-Hub-Signature-256'] ||
      event.headers['x-hub-signature-256']) as string;

    await probot.webhooks.verifyAndReceive({
      id: deliveryHeader,
      name: nameHeader,
      signature: sigHeader,
      payload: event.body ?? '',
    });

    probot.log.info('webhook verified');

    return {
      statusCode: 200,
      body: '{"ok":true}',
    };
  } catch (error) {
    probot.log.error(error);
    return {
      statusCode: error.status || error.statusCode || 500,
      error: 'Probot error',
    };
  }
};

export { handler };

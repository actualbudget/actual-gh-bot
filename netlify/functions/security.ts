import { advisoryEmbed } from './../../src/security/advisoryEmbed';
import { dependabotEmbed } from './../../src/security/dependabotEmbed';
import { Handler } from '@netlify/functions';
import { Webhooks } from '@octokit/webhooks';
import { WebhookEventName } from '@octokit/webhooks/types';

const postEmbed = async (targetWebhookUrl: string, embed: any) => {
  const response = await fetch(targetWebhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!response.ok) {
    console.error('Failed to send embed:', response.statusText);
    const text = await response.text();
    console.error('Response text:', text);
    throw new Error(`Failed to send embed: ${response.statusText}`);
  }
  return response;
};

const handler: Handler = async event => {
  try {
    const webhooks = new Webhooks({
      secret: process.env.GITHUB_WEBHOOK_SECRET || '',
    });

    const deliveryHeader = (event.headers['X-GitHub-Delivery'] ||
      event.headers['x-github-delivery']) as string;
    const nameHeader = (event.headers['X-GitHub-Event'] ||
      event.headers['x-github-event']) as WebhookEventName;
    const sigHeader = (event.headers['X-Hub-Signature-256'] ||
      event.headers['x-hub-signature-256']) as string;

    const targetWebhookUrl = event.queryStringParameters?.target;
    if (!targetWebhookUrl) {
      console.error('Missing target URL parameter');
      return {
        statusCode: 400,
        body: 'Missing target URL parameter',
      };
    }

    webhooks.on('dependabot_alert', ({ payload }) =>
      postEmbed(targetWebhookUrl, dependabotEmbed(payload)),
    );

    webhooks.on('repository_advisory', ({ payload }) =>
      postEmbed(targetWebhookUrl, advisoryEmbed(payload)),
    );

    webhooks.onAny(event => {
      console.log('Received event:', event.name);
    });

    let errorMessage = '';
    webhooks.onError(error => {
      console.error('Webhook error:', error.message);
      errorMessage = 'An error occurred while processing the webhook.';
    });

    await webhooks.verifyAndReceive({
      id: deliveryHeader,
      name: nameHeader,
      signature: sigHeader,
      payload: event.body ?? '',
    });

    if (errorMessage) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: errorMessage }),
      };
    }

    return {
      statusCode: 200,
      body: '{"ok":true}',
    };
  } catch (error: any) {
    console.error('Webhook error:', error);
    return {
      statusCode: error.status || error.statusCode || 500,
      body: JSON.stringify({ error: 'Processing error' }),
    };
  }
};

export { handler };

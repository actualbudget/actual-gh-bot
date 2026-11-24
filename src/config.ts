import { Context } from 'probot';

type FeatureFlag = 'enableFailingCI' | 'enableQA';

type ConfigObject = {
  featureFlags: {
    [key in FeatureFlag]: boolean;
  };
  qaWorkflow: string;
};

const defaultFeatureFlags: ConfigObject['featureFlags'] = {
  enableFailingCI: true,
  enableQA: false,
};

const defaultConfig: ConfigObject = {
  featureFlags: defaultFeatureFlags,
  qaWorkflow: 'pr-qa.yml',
};

type ConfigContext = Pick<Context, 'config'>;

const loadConfig = async (context: ConfigContext) =>
  await context.config('actual-gh-bot.yml', defaultConfig);

export async function checkFeatureFlag(
  context: ConfigContext,
  flagName: FeatureFlag,
) {
  const config = await loadConfig(context);
  return config?.featureFlags[flagName] ?? false;
}

export async function getQAWorkflow(context: ConfigContext) {
  const config = await loadConfig(context);
  return config?.qaWorkflow ?? defaultConfig.qaWorkflow;
}

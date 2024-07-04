import { Context } from 'probot';

type FeatureFlag = 'enableFailingCI';

type ConfigObject = {
  featureFlags: {
    [key in FeatureFlag]: boolean;
  };
};

const defaultFeatureFlags: ConfigObject['featureFlags'] = {
  enableFailingCI: true,
};

const defaultConfig: ConfigObject = {
  featureFlags: defaultFeatureFlags,
};

const loadConfig = async (context: Context) =>
  await context.config('actual-gh-bot.yml', defaultConfig);

export async function checkFeatureFlag(
  context: Context,
  flagName: FeatureFlag,
) {
  const config = await loadConfig(context);
  return config?.featureFlags[flagName] ?? false;
}

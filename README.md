# Actual GitHub Bot

## Overview

The Actual GitHub Bot is designed to help manage contributions to the Actual project repositories.

Node.js 22.12+, 24, or 26+ is required.

## Features
- Automated pull request labelling based on status
- Automated QA of pull requests by a Claude session (opt-in, see [Pull Request QA](#pull-request-qa))

## Installation

To install the Actual GitHub Bot, follow these steps:

1. Clone the repository:
   ```bash
   git clone https://github.com/actualbudget/actual-gh-bot.git
   ```
2. Navigate to the project directory:
   ```bash
   cd actual-gh-bot
   ```
3. Install dependencies:
   ```bash
   yarn install
   ```
5. Build to JavaScript
   ```bash
   yarn build
   ```

## Usage

Start the bot with:
```bash
yarn start
```

## Configuration

Initial configuration of the bot is handled by Probot on the first launch, it will guide you through the steps needed to link to GitHub and receive webhooks and autogenerate a .env file for you.

### Repository Specific Configuration

The Actual GitHub Bot allows repository-specific configurations through the `.github/actual-gh-bot.yml` file. This file is used to enable or disable certain features on a per-repository basis.

#### Configuration Options

- `featureFlags.enableFailingCI`: This boolean flag controls whether the bot should watch for failed CI runs and apply the "Failing CI" label. Default value: `true`
- `featureFlags.enableQA`: This boolean flag controls whether the bot starts a QA session for pull requests. Default value: `false`
- `qaWorkflow`: File name of the GitHub Actions workflow that runs the QA session. Default value: `pr-qa.yml`

### Pull Request QA

When `enableQA` is on, the bot drives a GitHub Actions workflow in the repository that runs Claude to QA the change:

- **PR opened**: the bot dispatches the QA workflow (`workflow_dispatch`) on the default branch with the inputs `pr_number` and `head_sha`. PRs opened by bots are skipped.
- **New commit pushed while a QA run is active**: the bot cancels the active run(s) for that PR and dispatches a new one. Nothing happens if no run is active.
- **QA comment posted**: the bot hides (minimizes as outdated) all previous QA comments on the PR.

The GitHub App needs the **Actions: Read and write** repository permission for this.

The workflow has to follow this contract:

- `run-name` must be exactly `PR QA #<pr_number>`; this is how the bot finds the active run of a PR.
- The result comment must be posted by a bot account (e.g. the workflow's `GITHUB_TOKEN`) and contain the marker `<!-- actual-bot-qa -->`.

The workflow runs for pull requests from forks, so it must treat everything derived from the pull request as untrusted: never check out or execute PR code, give the agent no GitHub token and no shell, and post the comment from a separate job that validates the agent's output. See `.github/workflows/pr-qa.yml` in [actualbudget/actual](https://github.com/actualbudget/actual) for the reference implementation.

## Contributing

We welcome contributions to enhance the bot's functionality. To contribute, please follow these steps:

1. Fork the repository.
2. Create a new branch:
   ```bash
   git checkout -b feature-branch
   ```
3. Make your changes and commit them:
   ```bash
   git commit -m "Add new feature"
   ```
4. Push to the branch:
   ```bash
   git push origin feature-branch
   ```
5. Create a pull request.

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for more details.

## Contact

For any questions or issues, please open an [issue](https://github.com/actualbudget/actual-gh-bot/issues).

## Sponsors

Thanks to our wonderful sponsors who make Actual budget possible!

<a href="https://www.netlify.com"> <img src="https://www.netlify.com/v3/img/components/netlify-color-accent.svg" alt="Deploys by Netlify" /> </a>

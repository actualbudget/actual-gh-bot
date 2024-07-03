# Actual GitHub Bot

## Overview

The Actual GitHub Bot is designed to help manage contributions to the Actual project repositories.

## Features
- Automated pull request labelling based on status

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


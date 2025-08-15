# VRT Workflow Integration

This bot now supports automatic VRT (Visual Regression Testing) screenshot updates through GitHub comments.

## How to Use

### Triggering VRT Screenshot Updates

To update VRT screenshots for a pull request, simply add a comment with the following command:

```
/update-vrt-new
```

### What Happens

When you comment `/update-vrt-new` on a pull request, the bot will:

1. **Dispatch Workflow**: Trigger a VRT workflow on the `actualbudget/actual` repository
2. **Monitor Progress**: Wait for the workflow to complete
3. **Download Artifacts**: Download the generated screenshot artifacts
4. **Process Screenshots**: Extract and process the screenshot files
5. **Commit Changes**: Create a new branch and commit the screenshots to `actualbudget/actual`
6. **Create PR**: Open a pull request with the updated screenshots

### Status Indicators

The bot provides status updates through emoji reactions on your original comment:

- 👀 **Eyes emoji**: Command is being processed and workflow is running
- 🚀 **Rocket emoji**: Success! VRT screenshots have been updated
- 😕 **Confused emoji**: Workflow completed but no screenshot artifacts were found
- 👎 **Thumbs down emoji**: Error occurred during processing

### Requirements

- The VRT workflow must be named `vrt.yml` in the `actualbudget/actual` repository
- The workflow should accept a `pr_number` input parameter
- The workflow should generate artifacts with names containing "screenshots" or "vrt"
- The bot must have appropriate permissions to:
  - Dispatch workflows on `actualbudget/actual`
  - Download artifacts
  - Create branches and commits
  - Create pull requests

### Configuration

The bot is configured to work with:

- **Target Repository**: `actualbudget/actual`
- **Workflow File**: `vrt.yml`
- **Base Branch**: `main`
- **Screenshot Directory**: `vrt-screenshots/`

### Error Handling

If any step fails, the bot will:

- Log the error for debugging
- Add a comment explaining what went wrong
- Provide guidance on how to retry

### Example VRT Workflow

Here's an example of what the `vrt.yml` workflow might look like:

```yaml
name: VRT Screenshots
on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'PR number to generate screenshots for'
        required: true
        type: string

jobs:
  generate-screenshots:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate VRT Screenshots
        run: |
          # Your screenshot generation logic here
          npm run generate-vrt-screenshots
      - name: Upload Screenshots
        uses: actions/upload-artifact@v4
        with:
          name: vrt-screenshots
          path: screenshots/
```

### Troubleshooting

If the bot isn't responding to the `/update-vrt-new` command:

1. **Check Permissions**: Ensure the bot has the necessary permissions on both repositories
2. **Verify Workflow**: Make sure the `vrt.yml` workflow exists and is properly configured
3. **Check Logs**: Review the bot's logs for any error messages
4. **Check Emoji Status**: Look for emoji reactions on your comment to see the current status
5. **Retry**: The command can be retried by commenting `/update-vrt-new` again

**Status Emoji Meanings:**

- 👀 = Processing (wait for completion)
- 🚀 = Success (screenshots updated)
- 😕 = Warning (no artifacts found)
- 👎 = Error (something went wrong)

### Security Considerations

- The bot only responds to comments on pull requests
- All operations are logged for audit purposes
- The bot uses GitHub's standard authentication and permissions system
- Screenshots are committed to a separate branch and require review via pull request

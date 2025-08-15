import { Probot, Context } from 'probot';
import { VrtService } from '../services/vrtService.js';

type IssueCommentContext = Context<
  'issue_comment.created' | 'issue_comment.edited'
>;

export default (app: Probot) => {
  app.on(
    ['issue_comment.created', 'issue_comment.edited'],
    async (context: IssueCommentContext) => {
      const { comment, issue } = context.payload;

      // Only handle comments on pull requests
      if (!issue.pull_request) {
        return;
      }

      const commentBody = comment.body.trim();

      // Check if the comment contains the /update-vrt-new command
      if (commentBody === '/update-vrt-new') {
        await handleUpdateVrt(context);
      }
    },
  );
};

async function handleUpdateVrt(context: IssueCommentContext) {
  const { comment, issue, repository } = context.payload;
  const { octokit } = context;

  try {
    // Add eyes emoji to show the command is being processed
    await octokit.reactions.createForIssueComment({
      owner: repository.owner.login,
      repo: repository.name,
      comment_id: comment.id,
      content: 'eyes',
    });

    const vrtService = new VrtService(octokit);

    // Dispatch the workflow
    await vrtService.dispatchWorkflow(issue.number);

    // Wait for workflow completion
    const runId = await vrtService.waitForWorkflowCompletion(issue.number);

    if (runId) {
      // Download artifacts
      const artifacts = await vrtService.downloadArtifacts(runId);

      if (artifacts.length > 0) {
        // Commit screenshots
        await vrtService.commitScreenshots(
          issue.number,
          artifacts,
          repository.name,
          repository.owner.login,
        );

        // Add rocket emoji for success
        await octokit.reactions.createForIssueComment({
          owner: repository.owner.login,
          repo: repository.name,
          comment_id: comment.id,
          content: 'rocket',
        });
      } else {
        // Add confused emoji for no artifacts
        await octokit.reactions.createForIssueComment({
          owner: repository.owner.login,
          repo: repository.name,
          comment_id: comment.id,
          content: 'confused',
        });
      }
    }
  } catch (error) {
    console.error('Error handling /update-vrt-new:', error);

    // Add -1 emoji for error
    await octokit.reactions.createForIssueComment({
      owner: repository.owner.login,
      repo: repository.name,
      comment_id: comment.id,
      content: '-1',
    });
  }
}

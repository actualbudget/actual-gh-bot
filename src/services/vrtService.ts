import { ProbotOctokit } from 'probot';
import AdmZip from 'adm-zip';

export class VrtService {
  private octokit: ProbotOctokit;
  private targetOwner: string = 'actualbudget';
  private targetRepo: string = 'actual';

  constructor(octokit: ProbotOctokit) {
    this.octokit = octokit;
  }

  async dispatchWorkflow(prNumber: number, workflowId: string = 'vrt.yml') {
    try {
      await this.octokit.actions.createWorkflowDispatch({
        owner: this.targetOwner,
        repo: this.targetRepo,
        workflow_id: workflowId,
        ref: 'main',
        inputs: {
          pr_number: prNumber.toString(),
        },
      });

      return true;
    } catch (error) {
      console.error('Failed to dispatch VRT workflow:', error);
      throw error;
    }
  }

  async waitForWorkflowCompletion(
    prNumber: number,
    timeoutMinutes: number = 30,
  ): Promise<number | null> {
    const startTime = Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Get recent workflow runs
        const { data: runs } = await this.octokit.actions.listWorkflowRuns({
          owner: this.targetOwner,
          repo: this.targetRepo,
          workflow_id: 'vrt.yml',
          per_page: 10,
        });

        // Find the most recent run for this PR
        const prRun = runs.workflow_runs.find(
          run =>
            run.head_branch === `pr-${prNumber}` ||
            (run.head_branch && run.head_branch.includes(prNumber.toString())),
        );

        if (prRun) {
          if (prRun.conclusion === 'success') {
            return prRun.id;
          } else if (
            prRun.conclusion === 'failure' ||
            prRun.conclusion === 'cancelled'
          ) {
            throw new Error(
              `Workflow failed with conclusion: ${prRun.conclusion}`,
            );
          }
          // If still running, continue waiting
        }

        // Wait 30 seconds before checking again
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        console.error('Error checking workflow status:', error);
        await new Promise(resolve => setTimeout(resolve, 30000));
      }
    }

    throw new Error('Workflow timeout exceeded');
  }

  async downloadArtifacts(runId: number): Promise<any[]> {
    try {
      // List artifacts for the workflow run
      const { data: artifacts } =
        await this.octokit.actions.listWorkflowRunArtifacts({
          owner: this.targetOwner,
          repo: this.targetRepo,
          run_id: runId,
        });

      const downloadedArtifacts = [];

      for (const artifact of artifacts.artifacts) {
        if (
          artifact.name.includes('screenshots') ||
          artifact.name.includes('vrt')
        ) {
          // Download the artifact
          const { data: download } =
            await this.octokit.actions.downloadArtifact({
              owner: this.targetOwner,
              repo: this.targetRepo,
              artifact_id: artifact.id,
              archive_format: 'zip',
            });

          downloadedArtifacts.push({
            name: artifact.name,
            data: download,
          });
        }
      }

      return downloadedArtifacts;
    } catch (error) {
      console.error('Failed to download artifacts:', error);
      throw error;
    }
  }

  async commitScreenshots(
    prNumber: number,
    screenshots: any[],
    sourceRepo: string,
    sourceOwner: string,
  ) {
    try {
      // Create a new branch for the screenshots
      const branchName = `update-vrt-screenshots-${prNumber}-${Date.now()}`;

      // Get the latest commit from main branch
      const { data: latestCommit } = await this.octokit.repos.getBranch({
        owner: this.targetOwner,
        repo: this.targetRepo,
        branch: 'main',
      });

      // Create the new branch
      await this.octokit.git.createRef({
        owner: this.targetOwner,
        repo: this.targetRepo,
        ref: `refs/heads/${branchName}`,
        sha: latestCommit.commit.sha,
      });

      // Process and commit each screenshot
      for (const screenshot of screenshots) {
        // Extract the zip data and process screenshots
        // This is a simplified version - you'll need to implement the actual file processing
        await this.processScreenshotArtifact(screenshot, branchName);
      }

      // Create a pull request to merge the changes
      await this.octokit.pulls.create({
        owner: this.targetOwner,
        repo: this.targetRepo,
        title: `Update VRT screenshots for PR #${prNumber}`,
        body: `This PR updates VRT screenshots for PR #${prNumber} from ${sourceOwner}/${sourceRepo}`,
        head: branchName,
        base: 'main',
      });
    } catch (error) {
      console.error('Failed to commit screenshots:', error);
      throw error;
    }
  }

  private async processScreenshotArtifact(artifact: any, branchName: string) {
    try {
      console.log(`Processing artifact: ${artifact.name}`);

      // Extract the zip file
      const zip = new AdmZip(artifact.data);
      const zipEntries = zip.getEntries();

      // Filter for image files
      const imageFiles = zipEntries.filter(entry => {
        const fileName = entry.entryName.toLowerCase();
        return (
          fileName.endsWith('.png') ||
          fileName.endsWith('.jpg') ||
          fileName.endsWith('.jpeg')
        );
      });

      if (imageFiles.length === 0) {
        console.log(`No image files found in artifact: ${artifact.name}`);
        return;
      }

      // Process each image file
      for (const imageFile of imageFiles) {
        const fileName = imageFile.entryName;
        const imageData = imageFile.getData();

        // Create the file in the repository
        await this.octokit.repos.createOrUpdateFileContents({
          owner: this.targetOwner,
          repo: this.targetRepo,
          path: `vrt-screenshots/${fileName}`,
          message: `Add VRT screenshot: ${fileName} from ${artifact.name}`,
          content: imageData.toString('base64'),
          branch: branchName,
        });

        console.log(`Uploaded screenshot: ${fileName}`);
      }
    } catch (error) {
      console.error(`Error processing artifact ${artifact.name}:`, error);
      throw error;
    }
  }
}

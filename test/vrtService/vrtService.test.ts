import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VrtService } from '../../src/services/vrtService.js';

// Mock the octokit client
const mockOctokit = {
  actions: {
    createWorkflowDispatch: vi.fn(),
    listWorkflowRuns: vi.fn(),
    listWorkflowRunArtifacts: vi.fn(),
    downloadArtifact: vi.fn(),
  },
  repos: {
    getBranch: vi.fn(),
    createOrUpdateFileContents: vi.fn(),
  },
  git: {
    createRef: vi.fn(),
  },
  pulls: {
    create: vi.fn(),
  },
};

describe('VrtService', () => {
  let vrtService: VrtService;

  beforeEach(() => {
    vi.clearAllMocks();
    vrtService = new VrtService(mockOctokit as any);
  });

  describe('dispatchWorkflow', () => {
    it('should dispatch a workflow with correct parameters', async () => {
      const prNumber = 123;
      const workflowId = 'vrt.yml';

      mockOctokit.actions.createWorkflowDispatch.mockResolvedValue({
        data: {},
      });

      await vrtService.dispatchWorkflow(prNumber, workflowId);

      expect(mockOctokit.actions.createWorkflowDispatch).toHaveBeenCalledWith({
        owner: 'actualbudget',
        repo: 'actual',
        workflow_id: workflowId,
        ref: 'main',
        inputs: {
          pr_number: prNumber.toString(),
        },
      });
    });

    it('should throw an error if workflow dispatch fails', async () => {
      const error = new Error('Workflow dispatch failed');
      mockOctokit.actions.createWorkflowDispatch.mockRejectedValue(error);

      await expect(vrtService.dispatchWorkflow(123)).rejects.toThrow(
        'Workflow dispatch failed',
      );
    });
  });

  describe('waitForWorkflowCompletion', () => {
    it('should return run ID when workflow completes successfully', async () => {
      const prNumber = 123;
      const runId = 456;

      mockOctokit.actions.listWorkflowRuns.mockResolvedValue({
        data: {
          workflow_runs: [
            {
              id: runId,
              head_branch: `pr-${prNumber}`,
              conclusion: 'success',
            },
          ],
        },
      });

      const result = await vrtService.waitForWorkflowCompletion(prNumber, 1);

      expect(result).toBe(runId);
    });

    // Note: The workflow completion test with failure is complex due to the polling mechanism
    // and is tested indirectly through the success case and error handling in the main handler
  });

  describe('downloadArtifacts', () => {
    it('should download and return artifacts', async () => {
      const runId = 456;
      const artifactId = 789;

      mockOctokit.actions.listWorkflowRunArtifacts.mockResolvedValue({
        data: {
          artifacts: [
            {
              id: artifactId,
              name: 'vrt-screenshots',
            },
          ],
        },
      });

      mockOctokit.actions.downloadArtifact.mockResolvedValue({
        data: Buffer.from('fake-zip-data'),
      });

      const result = await vrtService.downloadArtifacts(runId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('vrt-screenshots');
      expect(mockOctokit.actions.downloadArtifact).toHaveBeenCalledWith({
        owner: 'actualbudget',
        repo: 'actual',
        artifact_id: artifactId,
        archive_format: 'zip',
      });
    });

    it('should filter out non-screenshot artifacts', async () => {
      const runId = 456;

      mockOctokit.actions.listWorkflowRunArtifacts.mockResolvedValue({
        data: {
          artifacts: [
            {
              id: 789,
              name: 'vrt-screenshots',
            },
            {
              id: 790,
              name: 'other-artifact',
            },
          ],
        },
      });

      mockOctokit.actions.downloadArtifact.mockResolvedValue({
        data: Buffer.from('fake-zip-data'),
      });

      const result = await vrtService.downloadArtifacts(runId);

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('vrt-screenshots');
    });
  });

  describe('commitScreenshots', () => {
    it('should create branch and commit screenshots', async () => {
      const prNumber = 123;
      // Create a simple mock zip file for testing
      const mockZip = new (await import('adm-zip')).default();
      mockZip.addFile('screenshot1.png', Buffer.from('fake-image-data'));
      mockZip.addFile('screenshot2.png', Buffer.from('fake-image-data-2'));

      const screenshots = [
        {
          name: 'vrt-screenshots',
          data: mockZip.toBuffer(),
        },
      ];

      mockOctokit.repos.getBranch.mockResolvedValue({
        data: {
          commit: {
            sha: 'abc123',
          },
        },
      });

      mockOctokit.git.createRef.mockResolvedValue({ data: {} });
      mockOctokit.repos.createOrUpdateFileContents.mockResolvedValue({
        data: {},
      });
      mockOctokit.pulls.create.mockResolvedValue({ data: {} });

      await vrtService.commitScreenshots(
        prNumber,
        screenshots,
        'test-repo',
        'test-owner',
      );

      expect(mockOctokit.git.createRef).toHaveBeenCalled();
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalled();
      expect(mockOctokit.pulls.create).toHaveBeenCalledWith({
        owner: 'actualbudget',
        repo: 'actual',
        title: `Update VRT screenshots for PR #${prNumber}`,
        body: `This PR updates VRT screenshots for PR #${prNumber} from test-owner/test-repo`,
        head: expect.stringContaining('update-vrt-screenshots-'),
        base: 'main',
      });
    });
  });
});

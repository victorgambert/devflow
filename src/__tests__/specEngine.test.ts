/**
 * Spec Engine Main Orchestrator Tests
 * Currently only Phase 1 (refine) is active
 */

import { generateSpecification } from '../specEngine';
import * as refineAgent from '../agents/refineUserStory.agent';

// Mock the refine agent
jest.mock('../agents/refineUserStory.agent');

describe('Spec Engine', () => {
  const mockRefinedStory = {
    summary: 'Test summary',
    context: 'Test context',
    objectives: ['Objective 1'],
    constraints: ['Constraint 1'],
    dependencies: ['Dependency 1'],
    acceptance_criteria: ['AC 1'],
    risks: ['Risk 1'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (refineAgent.refineUserStory as jest.Mock).mockResolvedValue(mockRefinedStory);
  });

  describe('generateSpecification', () => {
    it('should run Phase 1 (refine) and return refined user story', async () => {
      const result = await generateSpecification('Test user story');

      expect(refineAgent.refineUserStory).toHaveBeenCalledWith('Test user story');
      expect(result.refined_user_story).toEqual(mockRefinedStory);
    });

    it('should throw error for empty user story', async () => {
      await expect(generateSpecification('')).rejects.toThrow(
        'User story cannot be empty'
      );
      await expect(generateSpecification('   ')).rejects.toThrow(
        'User story cannot be empty'
      );
    });

    it('should throw error for null/undefined user story', async () => {
      await expect(generateSpecification(null as unknown as string)).rejects.toThrow(
        'User story cannot be empty'
      );
      await expect(
        generateSpecification(undefined as unknown as string)
      ).rejects.toThrow('User story cannot be empty');
    });

    it('should propagate errors from refine stage', async () => {
      const error = new Error('Refine failed');
      (refineAgent.refineUserStory as jest.Mock).mockRejectedValue(error);

      await expect(generateSpecification('test')).rejects.toThrow('Refine failed');
    });
  });
});

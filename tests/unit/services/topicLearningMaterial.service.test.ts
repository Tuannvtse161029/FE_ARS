import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getMock, postMock, deleteMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  postMock: vi.fn(),
  deleteMock: vi.fn(),
}));

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: getMock,
    post: postMock,
    delete: deleteMock,
  },
}));

import { topicLearningMaterialService } from '../../../src/services/researchTopic.service';

describe('topicLearningMaterialService (BE-LEARNING-MATERIAL-TOPIC-ASSOCIATION-01)', () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
  });

  it('getByTopicId calls GET /api/ResearchTopic/{topicId}/learning-materials', async () => {
    getMock.mockResolvedValueOnce({
      data: [{ learningMaterialId: 10, topicId: 5, title: 'Sample Material', fileUrl: 'https://example.com/doc.pdf' }],
    });

    const res = await topicLearningMaterialService.getByTopicId(5);
    expect(getMock).toHaveBeenCalledWith('/api/ResearchTopic/5/learning-materials');
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe('Sample Material');
  });

  it('attach calls POST /api/ResearchTopic/{topicId}/learning-materials with learningMaterialId', async () => {
    postMock.mockResolvedValueOnce({
      data: { topicId: 5, learningMaterialId: 10, attachedAt: '2026-09-15T00:00:00Z' },
    });

    const res = await topicLearningMaterialService.attach(5, 10);
    expect(postMock).toHaveBeenCalledWith('/api/ResearchTopic/5/learning-materials', { learningMaterialId: 10 });
    expect(res.learningMaterialId).toBe(10);
  });

  it('createAndAttach calls POST /api/ResearchTopic/{topicId}/learning-materials/create', async () => {
    postMock.mockResolvedValueOnce({
      data: { learningMaterialId: 11, topicId: 5, title: 'New Doc', fileUrl: 'https://example.com/new.pdf' },
    });

    const res = await topicLearningMaterialService.createAndAttach(5, {
      lecturerId: 1,
      title: 'New Doc',
      fileUrl: 'https://example.com/new.pdf',
      description: null,
    });
    expect(postMock).toHaveBeenCalledWith('/api/ResearchTopic/5/learning-materials/create', {
      lecturerId: 1,
      title: 'New Doc',
      fileUrl: 'https://example.com/new.pdf',
      description: null,
    });
    expect(res.learningMaterialId).toBe(11);
  });

  it('detach calls DELETE /api/ResearchTopic/{topicId}/learning-materials/{materialId}', async () => {
    deleteMock.mockResolvedValueOnce({ data: {} });

    await topicLearningMaterialService.detach(5, 10);
    expect(deleteMock).toHaveBeenCalledWith('/api/ResearchTopic/5/learning-materials/10');
  });
});

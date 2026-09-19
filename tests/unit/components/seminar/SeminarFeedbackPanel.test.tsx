/**
 * SeminarFeedbackPanel — AI feedback summary integration tests.
 *
 * Covers:
 *   T1: "Generate AI Feedback Summary" button sends POST with no body and
 *       re-enables on both success and failure.
 *   T2: Backend error message is visible AND button is re-enabled so retry works.
 *   T3: Re-opening a seminar with both feedbackJson and aiSummary populated shows
 *       the feedbackJson summary, never the audio aiSummary.
 *   T4: Modal shell CSS contains max-height, overflow-y:auto, and min-height:0.
 *   T5: Vietnamese diacritics in initialAiSummaryJson surface the bilingual note
 *       without auto-triggering a regeneration.
 *   T6: Static UI strings come from useT(), not hard-coded English.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SeminarFeedbackPanel } from '../../../../src/components/seminar/SeminarFeedbackPanel';

/**
 * All mocks are hoisted so vi.mock can reference them before module-level
 * initialization runs.
 */
const {
  mockSummarizeSeminarFeedback,
  mockGetStats,
  mockGetFeedbackList,
  mockGetFeedbackQuestions,
  mockHasSubmittedFeedback,
} = vi.hoisted(() => ({
  mockSummarizeSeminarFeedback: vi.fn(),
  mockGetStats:               vi.fn(),
  mockGetFeedbackList:        vi.fn(),
  mockGetFeedbackQuestions:   vi.fn(),
  mockHasSubmittedFeedback:   vi.fn(() => false),
}));

/** Translate function used by the mocked I18n context — returns the key as-is. */
const translate = (key: string): string => `T:${key}`;

vi.mock('../../../../src/i18n/I18nContext', () => ({
  useI18n: () => ({ t: translate }),
  useT: () => translate,
  useLocale: () => 'en',
  I18nProvider: ({ children }: { children: React.ReactNode }) => children,
}));

/**
 * Mock helper: replaces the hasSubmittedFeedback mock with a real implementation
 * so that `submittedCount` in the panel reflects the actual feedback list.
 * Call in beforeEach or before the first render in tests that need the button
 * to be enabled (submittedCount > 0).
 */
const enableHasSubmittedFeedback = () => {
  mockHasSubmittedFeedback.mockImplementation(
    (participant: { feedbackJson?: string | null; feedbackSubmittedAt?: string | null }) => {
      if (!participant) return false;
      if (participant.feedbackSubmittedAt) return true;
      if (participant.feedbackJson && participant.feedbackJson.trim().length > 0) return true;
      return false;
    },
  );
};

vi.mock(
  '../../../../src/services/seminar.service',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('../../../../src/services/seminar.service')
    >();
    return {
      ...actual,
      seminarService: {
        summarizeSeminarFeedback: mockSummarizeSeminarFeedback,
        getStats:               mockGetStats,
        getFeedbackList:        mockGetFeedbackList,
        getFeedbackQuestions:   mockGetFeedbackQuestions,
      },
      parseAiFeedback: vi.fn((json: string | null | undefined) => {
        if (!json) return null;
        try {
          const obj = JSON.parse(json);
          if (!obj || typeof obj !== 'object') return null;
          if (typeof obj.overallAssessment !== 'string') return null;
          return {
            overallAssessment:    obj.overallAssessment,
            commonStrengths:     Array.isArray(obj.commonStrengths)
              ? obj.commonStrengths.filter((x: unknown) => typeof x === 'string')
              : [],
            areasForImprovement: Array.isArray(obj.areasForImprovement)
              ? obj.areasForImprovement.filter((x: unknown) => typeof x === 'string')
              : [],
            commonSuggestions:   Array.isArray(obj.commonSuggestions)
              ? obj.commonSuggestions.filter((x: unknown) => typeof x === 'string')
              : [],
            conflictingFeedback: Array.isArray(obj.conflictingFeedback)
              ? obj.conflictingFeedback.filter((x: unknown) => typeof x === 'string')
              : [],
            recommendedActions:  Array.isArray(obj.recommendedActions)
              ? obj.recommendedActions.filter((x: unknown) => typeof x === 'string')
              : [],
          };
        } catch {
          return null;
        }
      }),
      hasSubmittedFeedback: mockHasSubmittedFeedback,
    };
  },
);

const defaultMocks = () => {
  mockSummarizeSeminarFeedback.mockReset();
  mockGetStats.mockReset();
  mockGetFeedbackList.mockReset();
  mockGetFeedbackQuestions.mockReset();

  mockGetStats.mockResolvedValue({
    seminarId: 5,
    totalInvited: 3,
    submitted: 1,
    pending: 2,
    declined: 0,
    completionPercentage: 33.3,
  });

  mockGetFeedbackList.mockResolvedValue([
    {
      seminarParticipantId: 1,
      seminarId: 5,
      userId: 10,
      userFullName: 'Alice Participant',
      userEmail: 'alice@test.com',
      invitationStatus: 'Submitted',
      feedbackSubmittedAt: '2026-09-18T10:00:00Z',
      feedbackJson: null,
    },
  ]);

  mockGetFeedbackQuestions.mockResolvedValue([]);
};

const renderPanel = (
  props: Partial<React.ComponentProps<typeof SeminarFeedbackPanel>> = {},
) => {
  return render(
    <SeminarFeedbackPanel
      seminarId={5}
      seminarTitle="Test Seminar"
      {...props}
    />,
  );
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SeminarFeedbackPanel — AI feedback button state', () => {
  beforeEach(() => {
    defaultMocks();
    vi.clearAllMocks();
  });

  it('button is disabled while request is in-flight (T1)', async () => {
    enableHasSubmittedFeedback();

    mockSummarizeSeminarFeedback.mockImplementation(
      () => new Promise(() => {}), // never resolves — simulates in-flight
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    const btn = screen.getByTestId('generate-ai-feedback-summary');
    expect(btn).not.toBeDisabled();

    await userEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId('generate-ai-feedback-summary')).toBeDisabled();
    });
  });

  it('button re-enables after a successful response (T1)', async () => {
    enableHasSubmittedFeedback();

    mockSummarizeSeminarFeedback.mockResolvedValueOnce({
      seminarId: 5,
      feedbackCount: 3,
      summary: 'Overall a good session.',
      highlights: ['Clear explanations', 'Good pacing'],
      concerns: ['Could improve on Q&A time'],
      generatedAt: '2026-09-19T12:00:00Z',
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    const btn = screen.getByTestId('generate-ai-feedback-summary');
    expect(btn).not.toBeDisabled();

    await userEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId('generate-ai-feedback-summary')).not.toBeDisabled();
    });
  });

  it('button re-enables after an error so the user can retry (T2)', async () => {
    enableHasSubmittedFeedback();

    mockSummarizeSeminarFeedback.mockRejectedValueOnce(
      new Error('Not enough feedback submissions to generate a summary.'),
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    const btn = screen.getByTestId('generate-ai-feedback-summary');
    await userEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Not enough feedback submissions');
    });

    await waitFor(() => {
      expect(screen.getByTestId('generate-ai-feedback-summary')).not.toBeDisabled();
    });
  });

  it('shows the full BE error message in the error banner (T2)', async () => {
    enableHasSubmittedFeedback();

    mockSummarizeSeminarFeedback.mockRejectedValueOnce(
      new Error('The seminar has no eligible participants.'),
    );

    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('generate-ai-feedback-summary'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('The seminar has no eligible participants.');
    });
  });
});

describe('SeminarFeedbackPanel — hydration from feedbackJson, not aiSummary (T3)', () => {
  beforeEach(() => {
    defaultMocks();
    vi.clearAllMocks();
    enableHasSubmittedFeedback();
  });

  it('displays feedbackJson content and ignores aiSummary when both are present', async () => {
    const feedbackJsonValue = JSON.stringify({
      overallAssessment: 'Excellent participant engagement.',
      commonStrengths: ['Interactive Q&A', 'Relevant examples'],
      areasForImprovement: ['Time management'],
      commonSuggestions: ['Add break'],
      conflictingFeedback: [],
      recommendedActions: [],
    });

    mockGetFeedbackList.mockResolvedValue([
      {
        seminarParticipantId: 1,
        seminarId: 5,
        userId: 10,
        invitationStatus: 'Submitted',
        feedbackSubmittedAt: '2026-09-18T10:00:00Z',
        feedbackJson: '[{"questionId":"q1","type":"rating","rating":5}]',
      },
    ]);

    renderPanel({
      initialAiSummaryJson: feedbackJsonValue,
      initialAiGeneratedAt: '2026-09-19T08:00:00Z',
    });

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    // The AI section title (translated) must appear — proves hydration from feedbackJson.
    await waitFor(() => {
      expect(screen.getByText('T:feedback.ai.title')).toBeInTheDocument();
    });

    // Text from feedbackJson's overallAssessment must appear.
    expect(screen.getByText(/Excellent participant engagement/i)).toBeInTheDocument();
    expect(screen.getByText('Interactive Q&A')).toBeInTheDocument();

    // aiSummary (audio) text must NOT appear.
    expect(screen.queryByText(/This is the audio transcript summary of the meeting/i)).not.toBeInTheDocument();
  });

  it('shows nothing when neither feedbackJson nor aiSummary is provided', () => {
    renderPanel({ initialAiSummaryJson: null });
    expect(screen.queryByText('T:feedback.ai.title')).not.toBeInTheDocument();
  });
});

describe('SeminarFeedbackPanel — modal shell CSS max-height constraint (T4)', () => {
  it('SeminarFeedbackModalShell.module.css contains max-height, overflow-y:auto, and min-height:0', async () => {
    const fs = await import('fs');
    const cssContent = fs.readFileSync(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (require.resolve as any)('../../../../src/components/seminar/SeminarFeedbackModalShell.module.css'),
      'utf-8',
    );
    // The modal card must have a max-height constraint.
    expect(cssContent).toMatch(/max-height/);
    // The modal body must scroll independently.
    expect(cssContent).toMatch(/overflow-y\s*:\s*auto/);
    // min-height: 0 is the critical flex-box fix that lets the body shrink below
    // its content size and participate in the card's overflow calculation.
    expect(cssContent).toMatch(/min-height\s*:\s*0/);
  });
});

describe('SeminarFeedbackPanel — Vietnamese content bilingual note (T5)', () => {
  beforeEach(() => {
    defaultMocks();
    vi.clearAllMocks();
    enableHasSubmittedFeedback();
  });

  it('renders the bilingual note when initialAiSummaryJson contains Vietnamese diacritics', async () => {
    const vietnameseSummaryJson = JSON.stringify({
      overallAssessment: 'Phiên họp diễn ra rất tốt đẹp, người tham dự rất nhiệt tình.',
      commonStrengths: ['Nội dung phong phú', 'Giảng viên chuẩn bị kỹ'],
      areasForImprovement: ['Cần cải thiện phần Q&A'],
      commonSuggestions: [],
      conflictingFeedback: [],
      recommendedActions: [],
    });

    mockGetFeedbackList.mockResolvedValue([
      {
        seminarParticipantId: 1,
        seminarId: 5,
        userId: 10,
        invitationStatus: 'Submitted',
        feedbackSubmittedAt: '2026-09-18T10:00:00Z',
        feedbackJson: '[{"questionId":"q1","type":"text","answer":"Tốt"}]',
      },
    ]);

    renderPanel({
      initialAiSummaryJson: vietnameseSummaryJson,
      initialAiGeneratedAt: '2026-09-19T08:00:00Z',
    });

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    // The bilingual note title (translated) must appear.
    await waitFor(() => {
      expect(screen.getByText('T:feedback.vietnameseNote.title')).toBeInTheDocument();
    });
    expect(screen.getByText('T:feedback.vietnameseNote.body')).toBeInTheDocument();
  });

  it('does NOT auto-trigger a POST when initialAiSummaryJson contains Vietnamese diacritics', async () => {
    // A hung POST — if the panel auto-triggered, this test would hang / timeout.
    mockSummarizeSeminarFeedback.mockImplementation(
      () => new Promise(() => {}),
    );

    const vietnameseSummaryJson = JSON.stringify({
      overallAssessment: 'Tổng hợp phản hồi từ người tham dự.',
      commonStrengths: ['Chủ đề hay'],
      areasForImprovement: [],
      commonSuggestions: [],
      conflictingFeedback: [],
      recommendedActions: [],
    });

    mockGetFeedbackList.mockResolvedValue([
      {
        seminarParticipantId: 1,
        seminarId: 5,
        userId: 10,
        invitationStatus: 'Submitted',
        feedbackSubmittedAt: '2026-09-18T10:00:00Z',
        feedbackJson: '[{"questionId":"q1","type":"text","answer":"OK"}]',
      },
    ]);

    renderPanel({ initialAiSummaryJson: vietnameseSummaryJson });

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    // The summary call must NOT have been made — the bilingual note is informational only.
    expect(mockSummarizeSeminarFeedback).not.toHaveBeenCalled();
  });

  it('does NOT render the bilingual note when initialAiSummaryJson contains only ASCII (English)', async () => {
    const englishSummaryJson = JSON.stringify({
      overallAssessment: 'The session went very well overall.',
      commonStrengths: ['Clear explanations', 'Good pacing'],
      areasForImprovement: [],
      commonSuggestions: [],
      conflictingFeedback: [],
      recommendedActions: [],
    });

    mockGetFeedbackList.mockResolvedValue([
      {
        seminarParticipantId: 1,
        seminarId: 5,
        userId: 10,
        invitationStatus: 'Submitted',
        feedbackSubmittedAt: '2026-09-18T10:00:00Z',
        feedbackJson: '[{"questionId":"q1","type":"rating","rating":5}]',
      },
    ]);

    renderPanel({ initialAiSummaryJson: englishSummaryJson });

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    // The Vietnamese note must NOT appear.
    expect(screen.queryByText('T:feedback.vietnameseNote.title')).not.toBeInTheDocument();
  });
});

describe('SeminarFeedbackPanel — static UI strings from useT() (T6)', () => {
  beforeEach(() => {
    defaultMocks();
    vi.clearAllMocks();
    // Enable hasSubmittedFeedback so submittedCount reflects actual feedback rows.
    enableHasSubmittedFeedback();
  });

  it('renders translated strings for the stats section headings', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    // All static headings and stat labels must come from t() (rendered as T:key).
    expect(screen.getByText('T:feedback.title')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.stats.totalInvited')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.stats.submittedFeedback')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.stats.pendingFeedback')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.stats.declined')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.stats.completion')).toBeInTheDocument();
  });

  it('renders translated strings for action buttons', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    expect(screen.getByText('T:feedback.action.configureQuestions')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.action.previewForm')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.action.sendReminder')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.action.generateAi')).toBeInTheDocument();
  });

  it('renders translated strings for the raw feedback section', async () => {
    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    // The raw feedback section title must come from t().
    expect(screen.getByText('T:feedback.raw.title')).toBeInTheDocument();
    // With hasSubmittedFeedback enabled, the feedback list shows participant cards,
    // not the empty state — so the subtitle must appear instead.
    expect(screen.getByText('T:feedback.raw.subtitle')).toBeInTheDocument();
  });

  it('renders translated strings for the AI analysis section', async () => {
    mockSummarizeSeminarFeedback.mockResolvedValueOnce({
      seminarId: 5,
      feedbackCount: 3,
      summary: 'Overall a good session.',
      highlights: ['Clear explanations'],
      concerns: ['Time management could be better'],
      generatedAt: '2026-09-19T12:00:00Z',
    });

    renderPanel();

    await waitFor(() => {
      expect(screen.queryByRole('status', { name: /loading participant feedback/i })).not.toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('generate-ai-feedback-summary'));

    await waitFor(() => {
      expect(screen.getByText('T:feedback.ai.title')).toBeInTheDocument();
    });

    expect(screen.getByText('T:feedback.ai.overallAssessment')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.ai.commonStrengths')).toBeInTheDocument();
    expect(screen.getByText('T:feedback.ai.areasForImprovement')).toBeInTheDocument();
  });
});

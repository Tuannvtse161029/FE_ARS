/**
 * seminarFeedback.ts
 *
 * Types, default templates, and serialization helpers for Seminar Feedback
 * dynamic questions (Lecturer builder) and participant answers.
 *
 * Stored:
 * - Lecturer questions: Seminar.feedback (JSON string in NVARCHAR(MAX))
 * - Participant answers: SeminarParticipants.FeedbackJson (JSON string in NVARCHAR(MAX))
 *
 * Per ticket §15 the FE generates a stable client-side UUID for each new
 * question. The BE accepts missing IDs and backfills `q_1`, `q_2`, …, but
 * stable IDs let participant answers stay mapped when the host edits the
 * form (re-ordering, adding questions, etc.).
 */

export type FeedbackQuestionType = 'rating' | 'text';

export interface FeedbackQuestion {
  id: string;
  orderIndex: number;
  type: FeedbackQuestionType;
  questionText: string;
  isRequired: boolean;
  maxStar?: number; // Default: 5 for rating
  placeholder?: string; // Optional placeholder for text questions
}

/**
 * Canonical answer payload sent to `POST /api/Seminar/{id}/feedback`
 * (ticket §16.2). The FE sends only the primitives:
 * ```ts
 * { questionId, type, rating? | text? }
 * ```
 * and the BE normalizes `orderIndex` against the actual form config.
 */
export interface FeedbackAnswer {
  questionId: string;
  /** Best-effort order sent so newly-added questions stay ordered. The BE
   * re-orders against the form config when it persists (ticket §16). */
  orderIndex: number;
  type: FeedbackQuestionType;
  rating?: number;
  text?: string;
}

/**
 * Generate a stable client-side question ID per ticket §15. Uses
 * `crypto.randomUUID()` when available (modern browsers + secure contexts)
 * and falls back to a timestamp+random string for legacy environments.
 */
export const generateStableQuestionId = (): string => {
  if (
    typeof globalThis !== 'undefined' &&
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return `q_${globalThis.crypto.randomUUID()}`;
  }
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

/**
 * Standard default ARS feedback questions used for the "General Feedback Form".
 */
export const DEFAULT_GENERAL_QUESTIONS: readonly FeedbackQuestion[] = [
  {
    id: 'q_gen_relevance',
    orderIndex: 0,
    type: 'rating',
    questionText: 'Mức độ hữu ích và thực tế của nội dung hội thảo / Content relevance and practical value',
    isRequired: true,
    maxStar: 5,
  },
  {
    id: 'q_gen_speaker',
    orderIndex: 1,
    type: 'rating',
    questionText: 'Chất lượng truyền đạt và giải đáp thắc mắc của diễn giả / Speaker presentation and clarity',
    isRequired: true,
    maxStar: 5,
  },
  {
    id: 'q_gen_takeaway',
    orderIndex: 2,
    type: 'text',
    questionText: 'Điểm nổi bật hoặc bài học tâm đắc nhất bạn nhận được / Key takeaways & highlights',
    isRequired: false,
    placeholder: 'Chia sẻ ấn tượng hoặc kiến thức hữu ích nhất bạn đã tiếp thu...',
  },
  {
    id: 'q_gen_improvement',
    orderIndex: 3,
    type: 'text',
    questionText: 'Góp ý hoặc đề xuất để cải thiện các buổi hội thảo tiếp theo / Suggestions for improvement',
    isRequired: false,
    placeholder: 'Những điều có thể cải thiện về thời lượng, tổ chức hoặc chủ đề tiếp theo...',
  },
];

/** Local storage keys for caching and seamless persistence */
export const FEEDBACK_QUESTIONS_STORAGE_KEY_PREFIX = 'ars_seminar_feedback_questions_';
export const FEEDBACK_ANSWERS_STORAGE_KEY_PREFIX = 'ars_seminar_feedback_answers_';

export const parseSeminarQuestions = (raw?: string | null): FeedbackQuestion[] => {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item): item is FeedbackQuestion => (
          Boolean(item) &&
          typeof item.id === 'string' &&
          (item.type === 'rating' || item.type === 'text') &&
          typeof item.questionText === 'string'
        ))
        .sort((a, b) => a.orderIndex - b.orderIndex);
    }
  } catch {
    // If not JSON or invalid format, return empty array
  }
  return [];
};

export const serializeSeminarQuestions = (questions: FeedbackQuestion[]): string => {
  return JSON.stringify(
    questions.map((q, idx) => ({
      id: q.id,
      orderIndex: idx,
      type: q.type,
      questionText: q.questionText.trim(),
      isRequired: Boolean(q.isRequired),
      maxStar: q.type === 'rating' ? (q.maxStar || 5) : undefined,
      placeholder: q.placeholder?.trim() || undefined,
    }))
  );
};

export const parseParticipantAnswers = (raw?: string | null): FeedbackAnswer[] => {
  if (!raw || typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is FeedbackAnswer => (
        Boolean(item) &&
        typeof item.questionId === 'string' &&
        (item.type === 'rating' || item.type === 'text')
      ));
    }
  } catch {
    // Return empty on error
  }
  return [];
};

export const serializeParticipantAnswers = (answers: FeedbackAnswer[]): string => {
  return JSON.stringify(answers);
};

export const getCachedSeminarQuestions = (seminarId: number): FeedbackQuestion[] | null => {
  if (typeof window === 'undefined') return null;
  try {
    const cached = window.localStorage.getItem(`${FEEDBACK_QUESTIONS_STORAGE_KEY_PREFIX}${seminarId}`);
    if (cached) {
      const parsed = parseSeminarQuestions(cached);
      if (parsed.length > 0) return parsed;
    }
  } catch {
    // ignore storage errors
  }
  return null;
};

export const setCachedSeminarQuestions = (seminarId: number, questions: FeedbackQuestion[]): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${FEEDBACK_QUESTIONS_STORAGE_KEY_PREFIX}${seminarId}`,
      serializeSeminarQuestions(questions)
    );
  } catch {
    // ignore storage errors
  }
};

/**
 * seminarFeedback.ts
 *
 * Types, default templates, and serialization helpers for Seminar Feedback
 * dynamic questions (Lecturer builder) and participant answers.
 *
 * Stored:
 * - Lecturer questions: Seminar.feedback (JSON string in NVARCHAR(MAX))
 * - Participant answers: SeminarParticipant.feedbackJson (JSON string in NVARCHAR(MAX))
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

export interface FeedbackAnswer {
  questionId: string;
  orderIndex: number;
  type: FeedbackQuestionType;
  rating?: number;
  text?: string;
}

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

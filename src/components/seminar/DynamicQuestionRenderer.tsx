/**
 * DynamicQuestionRenderer.tsx
 *
 * Renders seminar feedback questions dynamically based on the Lecturer's configuration.
 * Supports:
 * - 'rating': 1–5 star interactive rating with descriptive labels
 * - 'text': Multi-line response textarea with character counter
 *
 * Shared between:
 * 1. Lecturer preview mode (previewing how participants see the questions)
 * 2. Participant feedback submission mode (filling in answers)
 */

import React, { useState } from 'react';
import { Star, Eye, AlertCircle } from 'lucide-react';
import { useLocale } from '../../i18n/I18nContext';
import type { FeedbackQuestion, FeedbackAnswer } from '../../types/seminarFeedback';
import styles from './DynamicQuestionRenderer.module.css';

export interface DynamicQuestionRendererProps {
  questions: FeedbackQuestion[];
  answers?: Record<string, FeedbackAnswer>;
  onAnswerChange?: (questionId: string, answer: FeedbackAnswer) => void;
  errors?: Record<string, string>;
  previewMode?: boolean;
  disabled?: boolean;
}

export const DynamicQuestionRenderer: React.FC<DynamicQuestionRendererProps> = ({
  questions,
  answers = {},
  onAnswerChange,
  errors = {},
  previewMode = false,
  disabled = false,
}) => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

  const [hoveredStars, setHoveredStars] = useState<Record<string, number>>({});

  const sortedQuestions = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);

  const getStarLabel = (rating: number): string => {
    switch (rating) {
      case 1:
        return copy('1 / 5 - Very Dissatisfied', '1 / 5 - Rất không hài lòng');
      case 2:
        return copy('2 / 5 - Dissatisfied', '2 / 5 - Chưa hài lòng');
      case 3:
        return copy('3 / 5 - Neutral / Average', '3 / 5 - Bình thường');
      case 4:
        return copy('4 / 5 - Satisfied', '4 / 5 - Hài lòng');
      case 5:
        return copy('5 / 5 - Excellent / Very Satisfied', '5 / 5 - Rất hài lòng / Xuất sắc');
      default:
        return copy('Click a star to rate', 'Nhấp vào số sao để đánh giá');
    }
  };

  const handleRatingClick = (question: FeedbackQuestion, rating: number) => {
    if (disabled && !previewMode) return;
    if (onAnswerChange) {
      onAnswerChange(question.id, {
        questionId: question.id,
        orderIndex: question.orderIndex,
        type: 'rating',
        rating,
      });
    }
  };

  const handleTextChange = (question: FeedbackQuestion, text: string) => {
    if (disabled && !previewMode) return;
    if (onAnswerChange) {
      onAnswerChange(question.id, {
        questionId: question.id,
        orderIndex: question.orderIndex,
        type: 'text',
        text,
      });
    }
  };

  if (sortedQuestions.length === 0) {
    return (
      <div className={styles.emptyState}>
        {copy('No questions configured for this feedback form.', 'Chưa có câu hỏi nào được thiết lập cho biểu mẫu này.')}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {previewMode && (
        <div className={styles.previewBanner} role="status">
          <Eye size={16} aria-hidden />
          <span>
            {copy(
              'Participant Preview Mode: This is how participants will see and answer your feedback form.',
              'Chế độ xem trước: Đây là giao diện người tham dự sẽ thấy và điền câu trả lời.'
            )}
          </span>
        </div>
      )}

      {sortedQuestions.map((q, idx) => {
        const error = errors[q.id];
        const currentAnswer = answers[q.id];
        const ratingVal = currentAnswer?.rating ?? 0;
        const textVal = currentAnswer?.text ?? '';
        const hoveredVal = hoveredStars[q.id] ?? 0;
        const displayRating = hoveredVal || ratingVal;
        const maxStar = q.maxStar || 5;

        return (
          <div
            key={q.id}
            className={`${styles.questionCard} ${error ? styles.questionCardError : ''}`}
          >
            <div className={styles.questionHeader}>
              <div className={styles.questionTitleGroup}>
                <span className={styles.questionIndex}>
                  {copy('Question', 'Câu')} {idx + 1}
                </span>
                <h4 className={styles.questionTitle}>
                  {q.questionText}
                  {q.isRequired ? (
                    <span className={styles.requiredMark} title={copy('Required', 'Bắt buộc')}>
                      *
                    </span>
                  ) : (
                    <span className={styles.optionalBadge}>
                      {copy('Optional', 'Không bắt buộc')}
                    </span>
                  )}
                </h4>
              </div>
            </div>

            {q.type === 'rating' && (
              <div className={styles.ratingContainer}>
                <div
                  className={styles.starsRow}
                  role="radiogroup"
                  aria-label={q.questionText}
                  onMouseLeave={() =>
                    setHoveredStars((prev) => ({ ...prev, [q.id]: 0 }))
                  }
                >
                  {Array.from({ length: maxStar }, (_, i) => i + 1).map((star) => {
                    const isFilled = star <= displayRating;
                    const isHovered = Boolean(hoveredVal && star <= hoveredVal);

                    return (
                      <button
                        key={star}
                        type="button"
                        className={`${styles.starBtn} ${isFilled ? styles.starActive : ''} ${
                          isHovered ? styles.starHovered : ''
                        }`}
                        onClick={() => handleRatingClick(q, star)}
                        onMouseEnter={() =>
                          setHoveredStars((prev) => ({ ...prev, [q.id]: star }))
                        }
                        disabled={disabled}
                        aria-label={`${star} ${copy('stars', 'sao')}`}
                        role="radio"
                        aria-checked={star === ratingVal}
                      >
                        <Star
                          size={24}
                          fill={isFilled ? 'currentColor' : 'none'}
                          stroke="currentColor"
                          strokeWidth={isFilled ? 1 : 1.5}
                        />
                      </button>
                    );
                  })}
                </div>
                <div
                  className={`${styles.ratingLabel} ${
                    ratingVal > 0 ? styles.ratingLabelSelected : ''
                  }`}
                >
                  {getStarLabel(displayRating)}
                </div>
              </div>
            )}

            {q.type === 'text' && (
              <div className={styles.textContainer}>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={textVal}
                  placeholder={
                    q.placeholder ||
                    copy('Write your answer here...', 'Nhập câu trả lời của bạn tại đây...')
                  }
                  onChange={(e) => handleTextChange(q, e.target.value)}
                  disabled={disabled}
                  maxLength={1000}
                />
                <div className={styles.textMeta}>
                  <span>{textVal.length} / 1000</span>
                </div>
              </div>
            )}

            {error && (
              <div className={styles.errorMessage} role="alert">
                <AlertCircle size={14} style={{ display: 'inline', marginRight: 4, verticalAlign: 'text-bottom' }} />
                {error}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DynamicQuestionRenderer;

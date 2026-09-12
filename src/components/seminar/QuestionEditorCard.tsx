/**
 * QuestionEditorCard.tsx
 *
 * Card component for the Lecturer to edit an individual feedback question:
 * - Title/Prompt text
 * - Question type toggle: Rating (1-5 Stars) vs Text (Freeform response)
 * - Required toggle
 * - Reorder controls (Move Up / Down)
 * - Delete button
 */


import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Star,
  AlignLeft,
  AlertCircle,
} from 'lucide-react';
import { useLocale } from '../../i18n/I18nContext';
import type { FeedbackQuestion, FeedbackQuestionType } from '../../types/seminarFeedback';
import styles from './QuestionEditorCard.module.css';

export interface QuestionEditorCardProps {
  question: FeedbackQuestion;
  index: number;
  totalCount: number;
  onUpdate: (updated: Partial<FeedbackQuestion>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  error?: string;
}

export const QuestionEditorCard = ({
  question,
  index,
  totalCount,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onDelete,
  error,
}: QuestionEditorCardProps) => {
  const locale = useLocale();
  const isVi = locale === 'vi';
  const copy = (en: string, vi: string) => (isVi ? vi : en);

  const handleTypeChange = (type: FeedbackQuestionType) => {
    onUpdate({ type });
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.headerLeft}>
          <span className={styles.orderBadge}>
            #{index + 1}
          </span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--ars-ink-muted)' }}>
            {question.type === 'rating'
              ? copy('Rating Question', 'Câu hỏi Đánh giá sao')
              : copy('Text Question', 'Câu hỏi Trả lời tự do')}
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onMoveUp}
            disabled={index === 0}
            title={copy('Move question up', 'Di chuyển lên')}
            aria-label={copy('Move question up', 'Di chuyển lên')}
          >
            <ChevronUp size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={onMoveDown}
            disabled={index === totalCount - 1}
            title={copy('Move question down', 'Di chuyển xuống')}
            aria-label={copy('Move question down', 'Di chuyển xuống')}
          >
            <ChevronDown size={16} aria-hidden />
          </button>
          <button
            type="button"
            className={`${styles.iconBtn} ${styles.deleteBtn}`}
            onClick={onDelete}
            disabled={totalCount <= 1}
            title={copy('Delete question', 'Xóa câu hỏi')}
            aria-label={copy('Delete question', 'Xóa câu hỏi')}
          >
            <Trash2 size={16} aria-hidden />
          </button>
        </div>
      </div>

      <div className={styles.formRow}>
        <label className={styles.label} htmlFor={`q-text-${question.id}`}>
          {copy('Question Content / Title', 'Nội dung câu hỏi')} <span style={{ color: 'var(--ars-danger)' }}>*</span>
        </label>
        <input
          id={`q-text-${question.id}`}
          type="text"
          className={`${styles.input} ${error ? styles.inputError : ''}`}
          value={question.questionText}
          placeholder={copy(
            'e.g. How would you rate the seminar content?',
            'Ví dụ: Bạn đánh giá thế nào về chất lượng nội dung buổi chia sẻ?'
          )}
          onChange={(e) => onUpdate({ questionText: e.target.value })}
        />
        {error && (
          <span className={styles.errorText} role="alert">
            <AlertCircle size={12} style={{ display: 'inline', marginRight: 4 }} />
            {error}
          </span>
        )}
      </div>

      <div className={styles.controlsRow}>
        <div className={styles.typeSelectorGroup}>
          <span className={styles.typeSelectorLabel}>
            {copy('Answer Format:', 'Định dạng câu trả lời:')}
          </span>
          <div className={styles.typeButtonGroup} role="radiogroup">
            <button
              type="button"
              className={`${styles.typeBtn} ${question.type === 'rating' ? styles.typeBtnActive : ''}`}
              onClick={() => handleTypeChange('rating')}
              aria-checked={question.type === 'rating'}
              role="radio"
            >
              <Star size={14} aria-hidden />
              <span>{copy('Rating (1–5 Stars)', 'Đánh giá (1–5 Sao)')}</span>
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${question.type === 'text' ? styles.typeBtnActive : ''}`}
              onClick={() => handleTypeChange('text')}
              aria-checked={question.type === 'text'}
              role="radio"
            >
              <AlignLeft size={14} aria-hidden />
              <span>{copy('Text (Written Answer)', 'Văn bản (Nhập câu trả lời)')}</span>
            </button>
          </div>
        </div>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            className={styles.checkboxInput}
            checked={question.isRequired}
            onChange={(e) => onUpdate({ isRequired: e.target.checked })}
          />
          <span>{copy('Required answer', 'Bắt buộc trả lời')}</span>
        </label>
      </div>

      {question.type === 'text' && (
        <div className={styles.formRow} style={{ marginTop: 4 }}>
          <label className={styles.label} htmlFor={`q-ph-${question.id}`}>
            {copy('Placeholder guide (optional)', 'Gợi ý câu trả lời (không bắt buộc)')}
          </label>
          <input
            id={`q-ph-${question.id}`}
            type="text"
            className={styles.input}
            value={question.placeholder || ''}
            placeholder={copy(
              'e.g. Share what you learned or suggestions...',
              'Ví dụ: Chia sẻ điều bạn tâm đắc nhất...'
            )}
            onChange={(e) => onUpdate({ placeholder: e.target.value })}
          />
        </div>
      )}
    </div>
  );
};

export default QuestionEditorCard;

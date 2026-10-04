import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ExternalLink,
  AlertTriangle,
  FileText,
  MessageSquare,
  Loader2,
  Tag,
  Download,
  AlertCircle,
} from 'lucide-react';
import styles from './ReportViolationPreviewModal.module.css';
import { forumPostService } from '../../services/forumPost.service';
import { forumCommentService } from '../../services/forumComment.service';
import { paperService, Paper } from '../../services/paper.service';
import type { ViolationReport } from '../../types/adminAuxiliary';
import type { ForumPost, ForumComment } from '../../types/forum.types';
import { useI18n, useLocale } from '../../i18n/I18nContext';
import { initialsFromName } from '../../pages/Forum/forum.utils';

interface ReportViolationPreviewModalProps {
  report: ViolationReport | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ReportViolationPreviewModal({
  report,
  isOpen,
  onClose,
}: ReportViolationPreviewModalProps): JSX.Element | null {
  const { t } = useI18n();
  const locale = useLocale();
  const intlTag = locale === 'en' ? 'en-US' : 'vi-VN';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [postData, setPostData] = useState<ForumPost | null>(null);
  const [commentData, setCommentData] = useState<ForumComment | null>(null);
  const [parentPostData, setParentPostData] = useState<ForumPost | null>(null);
  const [paperData, setPaperData] = useState<Paper | null>(null);

  const fetchData = useCallback(async () => {
    if (!report || !report.targetContentId) return;

    setLoading(true);
    setError(null);
    setPostData(null);
    setCommentData(null);
    setParentPostData(null);
    setPaperData(null);

    try {
      if (report.type === 'FORUM_POST') {
        const post = await forumPostService.getById(report.targetContentId);
        setPostData(post);
      } else if (report.type === 'FORUM_COMMENT') {
        const comment = await forumCommentService.getById(report.targetContentId);
        setCommentData(comment);

        if (comment.forumPostId) {
          try {
            const parentPost = await forumPostService.getById(comment.forumPostId);
            setParentPostData(parentPost);
          } catch {
            // Parent post may have been removed or unavailable
          }
        }
      } else if (report.type === 'RESEARCH_PAPER') {
        const paper = await paperService.getById(report.targetContentId);
        setPaperData(paper);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : null) ||
        t(
          'admin.contentReports.preview.error',
          'Unable to load reported content or it may have been deleted.',
        );
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [report, t]);

  useEffect(() => {
    if (isOpen && report) {
      void fetchData();
    }
  }, [isOpen, report, fetchData]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !report) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const getTargetBadge = () => {
    if (report.type === 'FORUM_POST') {
      return (
        <span className={`${styles.targetBadge} ${styles.targetBadgePost}`}>
          {t('admin.contentReports.table.typeForumPost', 'Forum Post')} #{report.targetContentId}
        </span>
      );
    }
    if (report.type === 'FORUM_COMMENT') {
      return (
        <span className={`${styles.targetBadge} ${styles.targetBadgeComment}`}>
          {t('admin.contentReports.table.typeForumComment', 'Forum Comment')} #{report.targetContentId}
        </span>
      );
    }
    return (
      <span className={`${styles.targetBadge} ${styles.targetBadgePaper}`}>
        {t('admin.contentReports.table.typeResearchPaper', 'Research Paper')} #{report.targetContentId}
      </span>
    );
  };

  const renderViolationNotice = () => (
    <div className={styles.reportContextBox}>
      <div className={styles.reportContextHeading}>
        <AlertTriangle size={15} />
        <span>{t('admin.contentReports.preview.reportedInfo', 'Violation Report Information')}</span>
      </div>
      <div className={styles.reportContextRow}>
        <span className={styles.reportContextLabel}>
          {t('admin.contentReports.preview.reason', 'Report Reason:')}
        </span>
        <span className={styles.reportContextValue}>{report.reason}</span>
      </div>
      {report.reportedContent && report.reportedContent !== '—' && (
        <div className={styles.reportContextRow}>
          <span className={styles.reportContextLabel}>
            {t('admin.contentReports.preview.notes', 'Reporter Notes:')}
          </span>
          <span className={styles.reportContextValue}>{report.reportedContent}</span>
        </div>
      )}
      <div className={styles.reportContextRow}>
        <span className={styles.reportContextLabel}>
          {t('admin.contentReports.preview.reportedBy', 'Reported By:')}
        </span>
        <span className={styles.reportContextValue}>{report.reportedByName}</span>
      </div>
    </div>
  );

  const renderPostContent = (post: ForumPost) => {
    const authorName = post.fullName || post.author || `User #${post.authorId ?? '—'}`;
    const authorInitials = initialsFromName(authorName);
    const postDate = post.createdAt || post.timestamp;

    return (
      <div className={styles.contentCard}>
        <div className={styles.authorRow}>
          <div className={styles.authorDetails}>
            {post.authorAvatar ? (
              <img
                src={post.authorAvatar}
                alt={authorName}
                className={styles.authorAvatar}
              />
            ) : (
              <div className={styles.authorInitials}>{authorInitials}</div>
            )}
            <div className={styles.authorMeta}>
              <span className={styles.authorName}>{authorName}</span>
              {postDate && (
                <span className={styles.postDate}>
                  {new Date(postDate).toLocaleString(intlTag)}
                </span>
              )}
            </div>
          </div>
          {post.category && <span className={styles.categoryPill}>{post.category}</span>}
        </div>

        {post.title && <h3 className={styles.postTitle}>{post.title}</h3>}

        {post.abstract && (
          <div className={styles.abstractBox}>
            <strong>{t('admin.contentReports.preview.abstract', 'Abstract')}: </strong>
            {post.abstract}
          </div>
        )}

        {post.content && (
          <div className={styles.postContentBody}>{post.content}</div>
        )}

        {post.tags && post.tags.length > 0 && (
          <div className={styles.tagList}>
            {post.tags.map((tag) => (
              <span key={tag} className={styles.tagPill}>
                <Tag size={11} /> {tag}
              </span>
            ))}
          </div>
        )}

        {(post.attachedImageUrl || post.attachedPdfUrl) && (
          <div className={styles.attachmentSection}>
            <span className={styles.attachmentTitle}>
              {t('admin.contentReports.preview.attachments', 'Attachments')}
            </span>
            {post.attachedImageUrl && (
              <img
                src={post.attachedImageUrl}
                alt="Post attachment"
                className={styles.imagePreview}
              />
            )}
            {post.attachedPdfUrl && (
              <a
                href={post.attachedPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.pdfAttachmentLink}
              >
                <FileText size={15} />
                <span>{t('common.viewPdf', 'View attached PDF')}</span>
                <Download size={13} />
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderCommentContent = (comment: ForumComment) => {
    const authorName = comment.fullName || comment.author || `User #${comment.userId ?? '—'}`;
    const authorInitials = initialsFromName(authorName);
    const commentDate = comment.createdAt;

    return (
      <div className={styles.contentCard}>
        <div className={styles.reportedCommentBox}>
          <span className={styles.reportedCommentBadge}>
            <AlertCircle size={12} />
            {t('admin.contentReports.preview.reportedComment', 'Reported Comment Content')}
          </span>

          <div className={styles.authorRow}>
            <div className={styles.authorDetails}>
              {comment.authorAvatar ? (
                <img
                  src={comment.authorAvatar}
                  alt={authorName}
                  className={styles.authorAvatar}
                />
              ) : (
                <div className={styles.authorInitials}>{authorInitials}</div>
              )}
              <div className={styles.authorMeta}>
                <span className={styles.authorName}>{authorName}</span>
                {commentDate && (
                  <span className={styles.postDate}>
                    {new Date(commentDate).toLocaleString(intlTag)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.postContentBody}>
            {comment.content || '—'}
          </div>
        </div>

        {parentPostData && (
          <div className={styles.parentPostContext}>
            <span className={styles.parentPostLabel}>
              <MessageSquare size={12} style={{ display: 'inline', marginRight: 4 }} />
              {t('admin.contentReports.preview.parentPost', 'Original Post containing this comment')}
            </span>
            <div className={styles.parentPostTitle}>{parentPostData.title}</div>
            {parentPostData.content && (
              <div className={styles.parentPostSnippet}>{parentPostData.content}</div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderPaperContent = (paper: Paper) => {
    const authorName = paper.researcherName || paper.authorName || '—';

    return (
      <div className={styles.contentCard}>
        <h3 className={styles.postTitle}>{paper.title || 'Untitled Paper'}</h3>

        <div className={styles.paperMetaGrid}>
          <div className={styles.paperMetaItem}>
            <span className={styles.paperMetaLabel}>
              {t('admin.contentReports.table.targetAuthor', 'Researcher / Author')}
            </span>
            <span className={styles.paperMetaValue}>{authorName}</span>
          </div>
          {paper.publicationDate && (
            <div className={styles.paperMetaItem}>
              <span className={styles.paperMetaLabel}>{t('common.date', 'Publication Date')}</span>
              <span className={styles.paperMetaValue}>
                {new Date(paper.publicationDate).toLocaleDateString(intlTag)}
              </span>
            </div>
          )}
          {paper.paperType && (
            <div className={styles.paperMetaItem}>
              <span className={styles.paperMetaLabel}>{t('common.type', 'Paper Type')}</span>
              <span className={styles.paperMetaValue}>{paper.paperType}</span>
            </div>
          )}
          {paper.quartile && (
            <div className={styles.paperMetaItem}>
              <span className={styles.paperMetaLabel}>Quartile</span>
              <span className={styles.paperMetaValue}>{paper.quartile}</span>
            </div>
          )}
        </div>

        {paper.abstract && (
          <div className={styles.abstractBox}>
            <strong>{t('admin.contentReports.preview.abstract', 'Abstract')}: </strong>
            {paper.abstract}
          </div>
        )}

        {paper.fileUrl && (
          <div className={styles.attachmentSection}>
            <a
              href={paper.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.pdfAttachmentLink}
            >
              <FileText size={15} />
              <span>{t('admin.paperIntake.viewPaper', 'View / Download Paper PDF')}</span>
              <ExternalLink size={13} />
            </a>
          </div>
        )}
      </div>
    );
  };

  const getLiveLink = () => {
    if (report.type === 'FORUM_POST' || report.type === 'FORUM_COMMENT') {
      return (
        <a
          href="/forum"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.externalForumLink}
        >
          <ExternalLink size={14} />
          {t('admin.contentReports.preview.openForum', 'Open in Forum')}
        </a>
      );
    }
    if (report.type === 'RESEARCH_PAPER') {
      return (
        <a
          href={`/admin/paper-submissions/${report.targetContentId}`}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.externalForumLink}
        >
          <ExternalLink size={14} />
          {t('admin.contentReports.preview.openPaper', 'View Paper Details')}
        </a>
      );
    }
    return null;
  };

  return createPortal(
    <div
      className={styles.overlay}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
    >
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <div className={styles.headerTitleGroup}>
            <h2 id="preview-modal-title" className={styles.headerTitle}>
              {t('admin.contentReports.preview.title', 'Inspect Reported Content')}
            </h2>
            {getTargetBadge()}
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </header>

        <div className={styles.body}>
          {renderViolationNotice()}

          {loading ? (
            <div className={styles.loadingState}>
              <Loader2 size={32} className={styles.spinner} />
              <span>{t('admin.contentReports.preview.loading', 'Loading violation content…')}</span>
            </div>
          ) : error ? (
            <div className={styles.errorState}>
              <AlertCircle size={32} color="var(--ars-error, #ef4444)" />
              <p className={styles.errorTitle}>
                {t('admin.contentReports.preview.error', 'Unable to load content or it may have been deleted.')}
              </p>
              <span style={{ fontSize: 13 }}>ID #{report.targetContentId}</span>
            </div>
          ) : postData ? (
            renderPostContent(postData)
          ) : commentData ? (
            renderCommentContent(commentData)
          ) : paperData ? (
            renderPaperContent(paperData)
          ) : null}
        </div>

        <footer className={styles.footer}>
          <div>{getLiveLink()}</div>
          <button type="button" className={styles.closeBtn} onClick={onClose}>
            {t('common.close', 'Close')}
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

export default ReportViolationPreviewModal;

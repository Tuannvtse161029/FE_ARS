import { useState } from 'react';
import { PdfViewer } from '../../components/PdfViewer';
import styles from './Forum.module.css';

interface Comment {
  id: string;
  author: string;
  avatarBg: string;
  text: string;
  replies?: Comment[];
}

export const Forum = () => {
  const [newPostTitle, setNewPostTitle] = useState('');
  const [commentText, setCommentText] = useState('');
  
  // Interactive comments state
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 'c1',
      author: 'Prof. Le_Lecturer',
      avatarBg: '#1e293b',
      text: 'Excellent methodology execution framework.',
      replies: [
        {
          id: 'c2',
          author: 'Student_PP',
          avatarBg: '#3b82f6',
          text: 'Agreed! Did you implement custom pool guards?'
        }
      ]
    }
  ]);

  const handlePublishThesis = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostTitle.trim()) {
      alert('Please enter a thesis title first.');
      return;
    }
    alert(`Success: "${newPostTitle}" has been published to the Public Forum Feed!`);
    setNewPostTitle('');
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    // Append as a new nested reply to Comment 1 to match the indented style
    const updated = [...comments];
    if (updated[0]) {
      updated[0].replies = [
        ...(updated[0].replies || []),
        {
          id: `${Date.now()}`,
          author: 'Student_Viewer',
          avatarBg: '#059669',
          text: commentText.trim()
        }
      ];
      setComments(updated);
    }
    setCommentText('');
  };

  return (
    <div className={styles.forumPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Public Research Forum Hub</span>
      </div>

      {/* Author Publication Panel */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeaderLabel}>AUTHOR PUBLICATION PANEL</div>
        
        <form onSubmit={handlePublishThesis} className={styles.publishForm}>
          <input
            type="text"
            className={styles.publishInput}
            value={newPostTitle}
            onChange={(e) => setNewPostTitle(e.target.value)}
            placeholder="Type your manuscript/thesis title to publish..."
          />
          <button type="submit" className={styles.publishBtn}>
            Publish Thesis to Public Forum Feed
          </button>
        </form>
      </div>

      {/* Expanded Thesis Thread */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeaderLabel}>PUBLIC ACADEMIC THREAD FEED</div>

        <div className={styles.thesisThread}>
          {/* Title & Verified Badges */}
          <h2 className={styles.threadTitle}>
            Title: A Modular Backend Network Protocol for High-Throughput Storage
          </h2>

          <div className={styles.badgesRow}>
            <span className={`${styles.badge} ${styles.badgeAuthor}`}>
              Published By: Researcher_DV
            </span>
            <span className={`${styles.badge} ${styles.badgeField}`}>
              Verified Field: Software Engineering
            </span>
            <span className={`${styles.badge} ${styles.badgeCertified}`}>
              ✓ Peer Reviewed
            </span>
          </div>

          {/* Abstract Description */}
          <div className={styles.abstractBlock}>
            <span className={styles.abstractLabel}>ABSTRACT</span>
            <p className={styles.abstractText}>
              This paper presents a modular backend network protocol engineered specifically for high-throughput distributed storage environments. The proposed framework decouples data ingestion, routing, and persistence layers into independently scalable service units, enabling sub-millisecond latency under sustained write loads exceeding 10 Gbps. Benchmarks conducted against canonical baseline architectures demonstrate a 3.4x improvement in sustained throughput and a 58% reduction in tail latency at the 99th percentile. The modular design further enables hot-swap replication strategies without requiring system quiescence.
            </p>
          </div>

          {/* Document Viewer */}
          <div className={styles.pdfViewerCard}>
            <div className={styles.pdfHeader}>
              <span className={styles.pdfHeaderTitle}>PDF VIEWER: Framework_Design_v2.pdf</span>
              <span className={styles.pageNumber}>Page 1 of 14</span>
            </div>
            <div className={styles.pdfBody}>
              <PdfViewer url="/sample.pdf" />
            </div>
          </div>

          {/* File Attachment download bar */}
          <div className={styles.attachmentBar}>
            <div className={styles.attachmentLeft}>
              <span className={styles.attachmentIcon}>⬇️</span>
              <div className={styles.attachmentMeta}>
                <span className={styles.attachmentName}>Framework_Design_Final_Approved.pdf</span>
                <span className={styles.attachmentSize}>14.2 MB · PDF Document</span>
              </div>
            </div>
            <a href="/sample.pdf" download className={styles.downloadBtn}>
              Download Artifact
            </a>
          </div>

          {/* Discussion comments thread */}
          <div className={styles.discussionSection}>
            <div className={styles.discussionHeader}>
              <span className={styles.discussionTitle}>DISCUSSION THREAD</span>
              <span className={styles.commentsCount}>{comments.length + (comments[0]?.replies?.length || 0)} comments</span>
            </div>

            <div className={styles.commentsList}>
              {comments.map((comment) => (
                <div key={comment.id} className={styles.commentBlock}>
                  {/* Top-level Comment */}
                  <div className={styles.commentItem}>
                    <div className={styles.commentUserAvatar} style={{ backgroundColor: comment.avatarBg }}>
                      {comment.author.slice(0, 2).toUpperCase()}
                    </div>
                    <div className={styles.commentMeta}>
                      <span className={styles.commentAuthorName}>{comment.author}</span>
                      <p className={styles.commentTextContent}>{comment.text}</p>
                    </div>
                  </div>

                  {/* Replies (Indented) */}
                  {comment.replies && comment.replies.map((reply) => (
                    <div key={reply.id} className={styles.replyItem}>
                      <div className={styles.replyLine}></div>
                      <div className={styles.commentUserAvatar} style={{ backgroundColor: reply.avatarBg }}>
                        {reply.author.slice(0, 2).toUpperCase()}
                      </div>
                      <div className={styles.commentMeta}>
                        <span className={styles.commentAuthorName}>{reply.author}</span>
                        <p className={styles.commentTextContent}>{reply.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Comment Form input */}
            <form onSubmit={handlePostComment} className={styles.commentForm}>
              <textarea
                className={styles.commentTextarea}
                placeholder="Write a public scholarly comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                rows={3}
              />
              <button type="submit" className={styles.postCommentBtn}>
                Post Comment
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Forum;

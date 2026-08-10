import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { CreatePostModal } from './components/CreatePostModal';
import { PdfViewer } from '../../components/PdfViewer';
import styles from './Forum.module.css';

interface Reply {
  id: string;
  author: { name: string; initials: string };
  time: string;
  replyTo: string;
  content: string;
}

interface Comment {
  id: string;
  author: { name: string; initials: string };
  time: string;
  content: string;
  likes: number;
  liked: boolean;
  replies: Reply[];
}

interface Post {
  id: string;
  author: { name: string; role: string; initials: string };
  time: string;
  content: string;
  attachment: { name: string; size: string; url?: string } | null;
  likes: number;
  liked: boolean;
  commentsCount: number;
  showComments: boolean;
  comments: Comment[];
}

// SVG Icons
const ListIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const UsersIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const LikeIcon = ({ filled }: { filled: boolean }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>
  </svg>
);

const CommentIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
  </svg>
);

const ShareIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"></circle>
    <circle cx="6" cy="12" r="3"></circle>
    <circle cx="18" cy="19" r="3"></circle>
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
  </svg>
);

const SendIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);

export const Forum = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'all' | 'following'>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [commentInputs, setCommentInputs] = useState<{ [postId: string]: string }>({});

  const username = user?.username || 'Dr. Nguyen Van A';
  const role = user?.role || 'Researcher';
  const userInitials = username
    .split(' ')
    .filter(n => n)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const [posts, setPosts] = useState<Post[]>([
    {
      id: '1',
      author: {
        name: 'Dr. Nguyen Van A',
        role: 'Researcher',
        initials: 'NA',
      },
      time: '2 hours ago',
      content:
        'We just uploaded the updated benchmark results for high-concurrency telemetry. The new architecture shows a 47% reduction in P99 latency under 10k concurrent connections — a significant improvement over the previous baseline.',
      attachment: {
        name: 'Framework_Design_v2.pdf',
        size: '2.4 MB',
        url: '/sample.pdf',
      },
      likes: 12,
      liked: false,
      commentsCount: 4,
      showComments: true,
      comments: [
        {
          id: 'c1',
          author: { name: 'Dr. Le Thi C', initials: 'LC' },
          time: '1h ago',
          content:
            'Excellent results! Have you also benchmarked memory allocation patterns under sustained load? The GC pressure at 10k+ connections can sometimes mask the true latency gains.',
          likes: 3,
          liked: false,
          replies: [
            {
              id: 'r1',
              author: { name: 'Dr. Nguyen Van A', initials: 'NA' },
              time: '45m ago',
              replyTo: '@Dr. Le Thi C',
              content:
                'Good point — we used off-heap buffers to minimize GC pressure. Memory stayed flat at ~2.1 GB throughout the 6-hour soak test.',
            },
          ],
        },
        {
          id: 'c2',
          author: { name: 'Dr. Akira Yamamoto', initials: 'AY' },
          time: '30m ago',
          content:
            'The lock-free CAS approach is the right call here. We observed similar gains in our distributed KV store. Would love to compare notes on the memory ordering semantics you used.',
          likes: 5,
          liked: false,
          replies: [],
        },
      ],
    },
    {
      id: '2',
      author: {
        name: 'Dr. Akira Yamamoto',
        role: 'Researcher',
        initials: 'AY',
      },
      time: '4 hours ago',
      content:
        'Just finished reviewing the consensus protocols for decentralized ledgers. The comparison between Raft and PBFT shows significant trade-offs in throughput vs tolerance bounds.',
      attachment: null,
      likes: 8,
      liked: false,
      commentsCount: 0,
      showComments: false,
      comments: [],
    },
  ]);

  const handleCreatePost = (
    content: string,
    file: { name: string; size: string; type: string; url?: string } | null
  ) => {
    const newPost: Post = {
      id: `${Date.now()}`,
      author: {
        name: username,
        role: role,
        initials: userInitials,
      },
      time: 'Just now',
      content: content,
      attachment: file ? { name: file.name, size: file.size, url: file.url || '/sample.pdf' } : null,
      likes: 0,
      liked: false,
      commentsCount: 0,
      showComments: false,
      comments: [],
    };
    setPosts([newPost, ...posts]);
  };

  const handleLikePost = (postId: string) => {
    setPosts(
      posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            liked: !post.liked,
            likes: post.liked ? post.likes - 1 : post.likes + 1,
          };
        }
        return post;
      })
    );
  };

  const handleToggleComments = (postId: string) => {
    setPosts(
      posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            showComments: !post.showComments,
          };
        }
        return post;
      })
    );
  };

  const handleLikeComment = (postId: string, commentId: string) => {
    setPosts(
      posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            comments: post.comments.map((comment) => {
              if (comment.id === commentId) {
                return {
                  ...comment,
                  liked: !comment.liked,
                  likes: comment.liked ? comment.likes - 1 : comment.likes + 1,
                };
              }
              return comment;
            }),
          };
        }
        return post;
      })
    );
  };

  const handleCommentInputChange = (postId: string, val: string) => {
    setCommentInputs({
      ...commentInputs,
      [postId]: val,
    });
  };

  const handleAddComment = (postId: string) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    const newComment: Comment = {
      id: `comment-${Date.now()}`,
      author: { name: username, initials: userInitials },
      time: 'Just now',
      content: text,
      likes: 0,
      liked: false,
      replies: [],
    };

    setPosts(
      posts.map((post) => {
        if (post.id === postId) {
          return {
            ...post,
            commentsCount: post.commentsCount + 1,
            comments: [...post.comments, newComment],
          };
        }
        return post;
      })
    );

    setCommentInputs({
      ...commentInputs,
      [postId]: '',
    });
  };

  const handleViewPdf = (url?: string) => {
    if (url) {
      setPdfViewerUrl(url);
    }
  };

  return (
    <div className={styles.forumPage}>
      {/* Header Info */}
      <div className={styles.forumHeader}>
        <h1 className={styles.pageTitle}>Forum</h1>
        <p className={styles.pageSubtitle}>Explore and share academic research with the community</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'all' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('all')}
        >
          <ListIcon />
          <div className={styles.tabText}>
            <span className={styles.tabTitle}>All Posts</span>
            <span className={styles.tabSub}>Browse all community research</span>
          </div>
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'following' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('following')}
        >
          <UsersIcon />
          <div className={styles.tabText}>
            <span className={styles.tabTitle}>Following</span>
            <span className={styles.tabSub}>Posts from people you follow</span>
          </div>
        </button>
      </div>

      {/* Main post area (Only show ifactiveTab is all for mockup) */}
      {activeTab === 'all' && (
        <div className={styles.feedContainer}>
          {/* Create Post Bar */}
          <div className={styles.createPostBar} onClick={() => setCreateModalOpen(true)}>
            <div className={styles.avatarCircle}>{userInitials}</div>
            <div className={styles.createPostInputPlaceholder}>
              Share your research thoughts, PDF paper, or image...
            </div>
            <button className={styles.createPostBtn} onClick={(e) => { e.stopPropagation(); setCreateModalOpen(true); }}>
              + Create Post
            </button>
          </div>

          {/* Posts Feed */}
          <div className={styles.postsList}>
            {posts.map((post) => (
              <div key={post.id} className={styles.postCard}>
                {/* Post Header */}
                <div className={styles.postHeader}>
                  <div className={styles.postAuthorInfo}>
                    <div className={styles.avatarCircle}>{post.author.initials}</div>
                    <div className={styles.authorMeta}>
                      <div className={styles.authorNameRow}>
                        <span className={styles.authorName}>{post.author.name}</span>
                        <span className={styles.authorRoleBadge}>{post.author.role}</span>
                      </div>
                      <span className={styles.postTime}>{post.time}</span>
                    </div>
                  </div>
                  <button className={styles.optionsBtn}>&bull;&bull;&bull;</button>
                </div>

                {/* Post Content */}
                <div className={styles.postBody}>
                  <p className={styles.postText}>{post.content}</p>

                  {/* Attachment Card */}
                  {post.attachment && (
                    <div className={styles.pdfAttachmentCard}>
                      <div className={styles.pdfIconWrapper}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.attachmentPdfSvg}>
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                      </div>
                      <div className={styles.pdfMetaInfo}>
                        <span className={styles.pdfName} title={post.attachment.name}>{post.attachment.name}</span>
                        <span className={styles.pdfSize}>{post.attachment.size}</span>
                      </div>
                      <button
                        className={styles.viewPdfBtn}
                        onClick={() => handleViewPdf(post.attachment?.url)}
                      >
                        View PDF
                      </button>
                    </div>
                  )}
                </div>

                {/* Post Actions */}
                <div className={styles.postActions}>
                  <button
                    className={`${styles.actionBtn} ${post.liked ? styles.likedAction : ''}`}
                    onClick={() => handleLikePost(post.id)}
                  >
                    <LikeIcon filled={post.liked} />
                    <span>Like ({post.likes})</span>
                  </button>
                  <button
                    className={`${styles.actionBtn} ${post.showComments ? styles.activeAction : ''}`}
                    onClick={() => handleToggleComments(post.id)}
                  >
                    <CommentIcon />
                    <span>Comment ({post.commentsCount})</span>
                  </button>
                  <button className={styles.actionBtn}>
                    <ShareIcon />
                    <span>Share</span>
                  </button>
                </div>

                {/* Comments Section */}
                {post.showComments && (
                  <div className={styles.commentsSection}>
                    {/* Add comment box */}
                    <div className={styles.writeCommentBox}>
                      <div className={styles.avatarCircleSmall}>{userInitials}</div>
                      <div className={styles.commentInputWrapper}>
                        <input
                          type="text"
                          placeholder="Write a comment..."
                          className={styles.commentInput}
                          value={commentInputs[post.id] || ''}
                          onChange={(e) => handleCommentInputChange(post.id, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddComment(post.id);
                          }}
                        />
                        <button
                          className={styles.sendCommentBtn}
                          onClick={() => handleAddComment(post.id)}
                        >
                          <SendIcon />
                        </button>
                      </div>
                    </div>

                    {/* Comments List */}
                    {post.comments.length > 0 && (
                      <div className={styles.commentsList}>
                        {post.comments.map((comment) => (
                          <div key={comment.id} className={styles.commentItem}>
                            <div className={styles.commentMain}>
                              <div className={styles.avatarCircleSmall}>
                                {comment.author.initials}
                              </div>
                              <div className={styles.commentContentCard}>
                                <div className={styles.commentHeader}>
                                  <span className={styles.commentAuthor}>
                                    {comment.author.name}
                                  </span>
                                  <span className={styles.commentTime}>{comment.time}</span>
                                </div>
                                <p className={styles.commentText}>{comment.content}</p>
                              </div>
                            </div>

                            {/* Comment actions (Like & Reply) */}
                            <div className={styles.commentActions}>
                              <button
                                className={`${styles.commentLikeBtn} ${
                                  comment.liked ? styles.commentLiked : ''
                                }`}
                                onClick={() => handleLikeComment(post.id, comment.id)}
                              >
                                {comment.likes > 0 ? `${comment.likes} ` : ''}Like
                              </button>
                              <button className={styles.commentReplyBtn}>Reply</button>
                            </div>

                            {/* Threaded Replies */}
                            {comment.replies && comment.replies.length > 0 && (
                              <div className={styles.repliesList}>
                                {comment.replies.map((reply) => (
                                  <div key={reply.id} className={styles.replyItem}>
                                    <div className={styles.avatarCircleSmall}>
                                      {reply.author.initials}
                                    </div>
                                    <div className={styles.replyContentCard}>
                                      <div className={styles.replyHeader}>
                                        <span className={styles.replyAuthor}>
                                          {reply.author.name}
                                        </span>
                                        <span className={styles.replyTime}>{reply.time}</span>
                                      </div>
                                      <p className={styles.replyText}>
                                        <span className={styles.replyTag}>{reply.replyTo}</span>{' '}
                                        {reply.content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Following Mock Panel */}
      {activeTab === 'following' && (
        <div className={styles.followingPlaceholder}>
          <UsersIcon />
          <h3>No activity yet</h3>
          <p>Posts from researchers you follow will show up here.</p>
        </div>
      )}

      {/* Create Post Modal */}
      <CreatePostModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onPublish={handleCreatePost}
        userInitials={userInitials}
        username={username}
      />

      {/* Fullscreen PDF Viewer Modal Overlay */}
      {pdfViewerUrl && (
        <div className={styles.pdfViewerModalOverlay}>
          <div className={styles.pdfViewerModalCard}>
            <div className={styles.pdfViewerHeader}>
              <h3 className={styles.pdfViewerTitle}>Document Preview</h3>
              <button className={styles.closePdfBtn} onClick={() => setPdfViewerUrl(null)}>
                Close Preview
              </button>
            </div>
            <div className={styles.pdfViewerBody}>
              <PdfViewer url={pdfViewerUrl} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forum;

import { useState, useRef } from 'react';
import styles from './Forum.module.css';
import { Heart } from '../../assets/icons/HeartIcon';
import { Eye } from '../../assets/icons/ViewsIcon';
import { MessageSquare, X, Tag, FileText, Image as ImageIcon, LayoutList, PenLine, UserCheck } from 'lucide-react';

type Category = 'All Posts' | 'My Posts' | 'Following';
type SortBy = 'Newest' | 'Most Discussed' | 'Most Viewed';

interface Post {
  id: string;
  title: string;
  author: string;
  avatarInitials: string;
  avatarColor: string;
  timestamp: string;
  abstract: string;
  tags: string[];
  likes: number;
  comments: number;
  views: number;
}

const ALL_POSTS: Post[] = [
  {
    id: '1',
    title: 'A Modular Backend Network Protocol for High-Throughput Storage',
    author: 'Dr. Nguyen Van A',
    avatarInitials: 'NA',
    avatarColor: '#eff6ff',
    timestamp: '2h ago',
    abstract:
      'This paper presents a modular backend network protocol engineered specifically for high-throughput distributed storage environments. The proposed framework decouples data ingestion, routing, and persistence layers into independently scalable service units.',
    tags: ['#SoftwareEngineering', '#Networks'],
    likes: 24,
    comments: 8,
    views: 312,
  },
  {
    id: '2',
    title: 'Transformer-Based Models for Low-Resource Languages',
    author: 'Prof. Le Thi B',
    avatarInitials: 'LB',
    avatarColor: '#f0fdf4',
    timestamp: '5h ago',
    abstract:
      'We explore transfer learning strategies using transformer architectures adapted for low-resource languages. Our approach achieves competitive results with 60% less labeled data compared to baseline models trained from scratch.',
    tags: ['#NLP', '#MachineLearning'],
    likes: 41,
    comments: 15,
    views: 589,
  },
  {
    id: '3',
    title: 'Quantum Computing Applications in Cryptography',
    author: 'Researcher_XYZ',
    avatarInitials: 'RX',
    avatarColor: '#fef9c3',
    timestamp: '1d ago',
    abstract:
      'An investigation into post-quantum cryptographic algorithms suitable for deployment in financial systems. We evaluate lattice-based and hash-based schemes under simulated quantum attack scenarios.',
    tags: ['#QuantumComputing', '#Cryptography'],
    likes: 17,
    comments: 4,
    views: 203,
  },
  {
    id: '4',
    title: 'Advances in Federated Learning for Privacy-Preserving AI',
    author: 'Researcher_DV',
    avatarInitials: 'RD',
    avatarColor: '#fdf4ff',
    timestamp: '2d ago',
    abstract:
      'We introduce a novel differential privacy mechanism integrated into the federated averaging algorithm, enabling stronger privacy guarantees without significant accuracy trade-offs in healthcare data applications.',
    tags: ['#MachineLearning', '#Privacy'],
    likes: 56,
    comments: 22,
    views: 941,
  },
  {
    id: '5',
    title: 'Energy-Efficient Routing Protocols for IoT Networks',
    author: 'Dr. Tran Van C',
    avatarInitials: 'TC',
    avatarColor: '#fff7ed',
    timestamp: '3d ago',
    abstract:
      'This work proposes a cluster-based routing protocol that dynamically adjusts transmission power based on residual energy levels, extending network lifetime by up to 40% compared to LEACH in large-scale IoT deployments.',
    tags: ['#IoT', '#Networks'],
    likes: 33,
    comments: 11,
    views: 478,
  },
];

export const Forum = () => {
  const [activeCategory, setActiveCategory] = useState<Category>('All Posts');
  const [sortBy, setSortBy] = useState<SortBy>('Newest');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [postContent, setPostContent] = useState('');
  const [postTags, setPostTags] = useState('');
  const [followingAuthors, setFollowingAuthors] = useState<Set<string>>(new Set());
  const [attachedPdf, setAttachedPdf] = useState<File | null>(null);
  const [attachedImage, setAttachedImage] = useState<File | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const categories: Category[] = ['All Posts', 'My Posts', 'Following'];

  const filteredPosts = ALL_POSTS.filter((post) => {
    if (activeCategory === 'All Posts') return true;
    if (activeCategory === 'My Posts') return post.author === 'Dr. Nguyen Van A';
    if (activeCategory === 'Following') return followingAuthors.has(post.author);
    return true;
  });

  return (
    <div className={styles.forumPage}>
      <div className={styles.forumLayout}>
        {/* ─── LEFT SIDEBAR ─── */}
        <aside className={styles.sidebar}>
          <h1 className={styles.forumTitle}>FORUM</h1>

          {/* Categories */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarSectionLabel}>Categories</div>
            <div className={styles.categoryList}>
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`${styles.categoryItem} ${activeCategory === cat ? styles.categoryItemActive : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat === 'All Posts' && <LayoutList size={14} className={styles.catIcon} />}
                  {cat === 'My Posts' && <PenLine size={14} className={styles.catIcon} />}
                  {cat === 'Following' && <UserCheck size={14} className={styles.catIcon} />}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Filters */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarSectionLabel}>Filters</div>
            <div className={styles.filterInputs}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Author</label>
                <input
                  type="text"
                  className={styles.filterInput}
                  placeholder="Search author..."
                />
              </div>
            </div>
          </div>
        </aside>

        {/* ─── RIGHT FEED ─── */}
        <div className={styles.feed}>
          {/* Feed Header */}
          <div className={styles.feedHeader}>
            <div className={styles.feedTitleRow}>
              <h2 className={styles.feedTitle}>PUBLIC FORUM</h2>
              <span className={styles.postCountBadge}>{filteredPosts.length} posts</span>
              <button
                className={styles.createPostBtn}
                onClick={() => setIsCreateModalOpen(true)}
              >
                + Create Post
              </button>
            </div>

            {/* Sort & Filter Toolbar */}
            <div className={styles.toolbar}>
              <select
                className={styles.sortSelect}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option>Newest</option>
                <option>Most Discussed</option>
                <option>Most Viewed</option>
              </select>
            </div>
          </div>

          {/* Post Cards */}
          <div className={styles.postList}>
            {filteredPosts.map((post) => (
              <div key={post.id} className={styles.postCard}>
                {/* Author row */}
                <div className={styles.postAuthorRow}>
                  <div
                    className={styles.postAvatar}
                    style={{ backgroundColor: post.avatarColor, color: '#0f172a' }}
                  >
                    {post.avatarInitials}
                  </div>
                  <div className={styles.postAuthorInfo}>
                    <span className={styles.postAuthorName}>{post.author}</span>
                    <span className={styles.postTimestamp}>{post.timestamp}</span>
                  </div>
                  {(activeCategory !== 'Following' || !followingAuthors.has(post.author)) && post.author !== 'Dr. Nguyen Van A' && (
                    <button
                      className={`${styles.cardFollowBtn} ${followingAuthors.has(post.author) ? styles.following : ''}`}
                      onClick={() => {
                        setFollowingAuthors(prev => {
                          const next = new Set(prev);
                          if (next.has(post.author)) {
                            next.delete(post.author);
                          } else {
                            next.add(post.author);
                          }
                          return next;
                        });
                      }}
                    >
                      {followingAuthors.has(post.author) ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>

                {/* Title */}
                <h3 className={styles.postTitle}>{post.title}</h3>

                {/* Abstract */}
                <p className={styles.postAbstract}>{post.abstract}</p>

                {/* Tags */}
                <div className={styles.postTags}>
                  {post.tags.map((tag) => (
                    <span key={tag} className={styles.postTag}>
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Stats row */}
                <div className={styles.postStats}>
                  <span className={styles.postStatItem}>
                    <Heart size={14} />
                    {post.likes}
                  </span>
                  <span className={styles.postStatItem}>
                    <MessageSquare size={14} />
                    {post.comments}
                  </span>
                  <span className={styles.postStatItem}>
                    <Eye size={14} />
                    {post.views}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      {isCreateModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsCreateModalOpen(false)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Create Forum Post</h2>
            </div>

            {/* Author Header */}
            <div className={styles.modalAuthorHeader}>
              <div
                className={styles.modalAuthorAvatar}
                style={{ backgroundColor: '#eff6ff', color: '#0f172a' }}
              >
                NA
              </div>
              <div className={styles.modalAuthorInfo}>
                <span className={styles.modalAuthorName}>Dr. Nguyen Van A</span>
                <span className={styles.modalPostingTo}>Posting to Forums</span>
              </div>
            </div>

            <div className={styles.modalBody}>
              {/* Plain Textarea - no label */}
              <textarea
                className={styles.modalTextarea}
                placeholder="Share your thoughts..."
                rows={8}
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
              />

              {/* Tag Input with # prefix display */}
              <div className={styles.tagInputRow}>
                <label className={styles.tagLabel}>
                  <Tag size={14} />
                  Tags
                </label>
                <div className={styles.tagInputWrapper}>
                  <span className={styles.tagHashPrefix}>#</span>
                  <input
                    type="text"
                    className={styles.tagInputField}
                    placeholder="Add tags..."
                    value={postTags}
                    onChange={(e) => setPostTags(e.target.value)}
                  />
                </div>
              </div>

              {/* Attachment Buttons */}
              <div className={styles.attachmentRow}>
                <button
                  className={styles.attachPdfBtn}
                  onClick={() => pdfInputRef.current?.click()}
                >
                  <FileText size={16} />
                  Attach PDF Paper
                </button>
                <input
                  type="file"
                  ref={pdfInputRef}
                  accept=".pdf"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAttachedPdf(file);
                  }}
                />

                <button
                  className={styles.uploadImgBtn}
                  onClick={() => imageInputRef.current?.click()}
                >
                  <ImageIcon size={16} />
                  Upload Image
                </button>
                <input
                  type="file"
                  ref={imageInputRef}
                  accept="image/*"
                  className={styles.hiddenInput}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setAttachedImage(file);
                  }}
                />
              </div>

              {/* Show attached files */}
              {(attachedPdf || attachedImage) && (
                <div className={styles.attachedFilesList}>
                  {attachedPdf && (
                    <div className={styles.attachedFile}>
                      <FileText size={14} />
                      <span>{attachedPdf.name}</span>
                      <button
                        className={styles.removeFileBtn}
                        onClick={() => setAttachedPdf(null)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                  {attachedImage && (
                    <div className={styles.attachedFile}>
                      <ImageIcon size={14} />
                      <span>{attachedImage.name}</span>
                      <button
                        className={styles.removeFileBtn}
                        onClick={() => setAttachedImage(null)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelBtn}
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className={styles.publishBtn}
                disabled={!postContent.trim()}
                onClick={() => {
                  console.log('Post published:', { content: postContent, tags: postTags, pdf: attachedPdf?.name, image: attachedImage?.name });
                  setIsCreateModalOpen(false);
                  setPostContent('');
                  setPostTags('');
                  setAttachedPdf(null);
                  setAttachedImage(null);
                }}
              >
                Publish Post
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Forum;

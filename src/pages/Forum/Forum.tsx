import { useState } from 'react';
import styles from './Forum.module.css';
import { Heart } from '../../assets/icons/HeartIcon';
import { Eye } from '../../assets/icons/ViewsIcon';
import { MessageSquare } from 'lucide-react';

type Category = 'All Posts' | 'My Posts' | 'Bookmarked';
type Topic = 'All Topics' | 'Research' | 'Review' | 'Seminar' | 'Milestones' | 'Groups';
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
  const [activeTopic, setActiveTopic] = useState<Topic>('All Topics');
  const [sortBy, setSortBy] = useState<SortBy>('Newest');

  const filteredPosts = ALL_POSTS.filter((post) => {
    if (activeTopic !== 'All Topics') {
      return post.tags.some((t) => t.toLowerCase().includes(activeTopic.toLowerCase()));
    }
    return true;
  });

  const categories: Category[] = ['All Posts', 'My Posts', 'Bookmarked'];
  const topics: Topic[] = ['All Topics', 'Research', 'Review', 'Seminar', 'Milestones', 'Groups'];

  return (
    <div className={styles.forumPage}>
      {/* Breadcrumbs */}
      <div className={styles.breadcrumbs}>
        Home &gt; <span className={styles.activeBreadcrumb}>Forums</span>
      </div>

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
                  {cat === 'All Posts' && <span className={styles.catIcon}>📋</span>}
                  {cat === 'My Posts' && <span className={styles.catIcon}>✏️</span>}
                  {cat === 'Bookmarked' && <span className={styles.catIcon}>🔖</span>}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div className={styles.sidebarSection}>
            <div className={styles.sidebarSectionLabel}>Topics</div>
            <div className={styles.topicList}>
              {topics.map((topic) => (
                <button
                  key={topic}
                  className={`${styles.topicPill} ${activeTopic === topic ? styles.topicPillActive : ''}`}
                  onClick={() => setActiveTopic(topic)}
                >
                  {topic}
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
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Date Range</label>
                <div className={styles.dateRangeRow}>
                  <input type="date" className={styles.filterInput} />
                  <span className={styles.dateSeparator}>—</span>
                  <input type="date" className={styles.filterInput} />
                </div>
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
              <select
                className={styles.topicFilterSelect}
                value={activeTopic}
                onChange={(e) => setActiveTopic(e.target.value as Topic)}
              >
                {topics.map((t) => (
                  <option key={t}>{t}</option>
                ))}
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
    </div>
  );
};

export default Forum;

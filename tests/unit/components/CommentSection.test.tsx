import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommentSection } from '../../../src/components/forum/CommentSection';
import type { ForumComment } from '../../../src/types/forum.types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: { userId: 10, username: 'testuser' },
    isAuthenticated: true,
  }),
}));

vi.mock('../../../src/hooks/usePermissions', () => ({
  usePermissions: () => ({
    isVerified: true,
  }),
}));

vi.mock('../../../src/hooks/useCanInteractInForum', () => ({
  useCanInteractInForum: () => ({
    canInteract: true,
    reason: null,
  }),
}));

vi.mock('../../../src/i18n/I18nContext', () => ({
  useI18n: () => ({
    t: (key: string, fallback?: string, params?: Record<string, string>) => {
      let text = fallback || key;
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          text = text.replace(`{${k}}`, v);
        });
      }
      return text;
    },
    language: 'en',
  }),
}));

vi.mock('../../../src/services/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

vi.mock('../../../src/utils/storage', () => ({
  storage: {
    getUser: () => ({ id: 10, username: 'testuser', fullName: 'Test User' }),
  },
}));

const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockRemove = vi.fn();
const mockToggleVote = vi.fn();

vi.mock('../../../src/hooks/useForumComments', () => ({
  useForumComments: () => ({
    comments: [],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useForumCommentMutations: () => ({
    create: mockCreate,
    update: mockUpdate,
    remove: mockRemove,
    toggleVote: mockToggleVote,
  }),
}));

describe('CommentSection - Reply functionality', () => {
  const initialComments: ForumComment[] = [
    {
      id: 1,
      postId: 100,
      userId: 20,
      content: 'Parent comment from author 20',
      createdAt: new Date().toISOString(),
      upvoteCount: 3,
      replyId: null,
    },
    {
      id: 2,
      postId: 100,
      userId: 30,
      content: 'Existing child reply to comment 1',
      createdAt: new Date().toISOString(),
      upvoteCount: 1,
      replyId: 1,
    },
  ];

  const authorMap = {
    20: 'Alice',
    30: 'Bob',
    10: 'Test User',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders comments, hierarchical replies, and Reply button on comments', () => {
    render(
      <CommentSection
        postId={100}
        comments={initialComments}
        authorDisplayByUserId={authorMap}
      />
    );

    expect(screen.getByText('Parent comment from author 20')).toBeInTheDocument();
    expect(screen.getByText('Existing child reply to comment 1')).toBeInTheDocument();
    expect(screen.getByText('Replying to @Alice')).toBeInTheDocument();

    const replyBtns = screen.getAllByLabelText('Reply');
    expect(replyBtns.length).toBeGreaterThanOrEqual(2);
  });

  it('opens inline reply box when clicking Reply on a comment', async () => {
    const user = userEvent.setup();
    render(
      <CommentSection
        postId={100}
        comments={initialComments}
        authorDisplayByUserId={authorMap}
      />
    );

    const replyBtn = screen.getByTestId('reply-btn-1');
    await user.click(replyBtn);

    const replyBox = screen.getByTestId('inline-reply-block');
    expect(replyBox).toBeInTheDocument();
    expect(within(replyBox).getByPlaceholderText('Write a reply…')).toBeInTheDocument();
    expect(within(replyBox).getByText('Replying to @Alice')).toBeInTheDocument();
  });

  it('cancels inline reply when clicking Cancel', async () => {
    const user = userEvent.setup();
    render(
      <CommentSection
        postId={100}
        comments={initialComments}
        authorDisplayByUserId={authorMap}
      />
    );

    await user.click(screen.getByTestId('reply-btn-1'));
    const replyBox = screen.getByTestId('inline-reply-block');
    expect(replyBox).toBeInTheDocument();

    const cancelBtns = within(replyBox).getAllByRole('button', { name: 'Cancel' });
    await user.click(cancelBtns[0]);

    expect(screen.queryByTestId('inline-reply-block')).not.toBeInTheDocument();
  });

  it('submits reply with replyId when filled and submitted', async () => {
    const user = userEvent.setup();
    const createdReply: ForumComment = {
      id: 3,
      postId: 100,
      userId: 10,
      content: 'This is my reply',
      createdAt: new Date().toISOString(),
      upvoteCount: 0,
      replyId: 1,
    };
    mockCreate.mockResolvedValueOnce(createdReply);

    render(
      <CommentSection
        postId={100}
        comments={initialComments}
        authorDisplayByUserId={authorMap}
      />
    );

    await user.click(screen.getByTestId('reply-btn-1'));
    const replyBox = screen.getByTestId('inline-reply-block');
    const textarea = within(replyBox).getByPlaceholderText('Write a reply…');
    await user.type(textarea, 'This is my reply');

    // Post Reply button inside the inline composer
    const submitBtn = within(replyBox).getByRole('button', { name: 'Reply' });
    await user.click(submitBtn);

    expect(mockCreate).toHaveBeenCalledWith({
      userId: 10,
      forumPostId: 100,
      content: 'This is my reply',
      replyId: 1,
    });

    await waitFor(() => {
      expect(screen.queryByTestId('inline-reply-block')).not.toBeInTheDocument();
      expect(screen.getByText('This is my reply')).toBeInTheDocument();
    });
  });
});

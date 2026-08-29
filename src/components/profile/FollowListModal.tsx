import React, { useCallback, useEffect, useState } from 'react';
import { X, Users } from 'lucide-react';
import { followerService } from '../../services/follower.service';
import { useAuth } from '../../context/AuthContext';
import type { FollowerResponse } from '../../types/domain';
import styles from './FollowListModal.module.css';

interface FollowListModalProps {
  isOpen: boolean;
  initialTab?: 'followers' | 'following';
  userId: number;
  onClose: () => void;
  onCountsChanged?: () => void;
}

const PALETTE = ['#0284c7', '#0d9488', '#16a34a', '#ca8a04', '#ea580c', '#e11d48', '#9333ea', '#4f46e5'];

function deriveInitials(name?: string | null): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const FollowListModal: React.FC<FollowListModalProps> = ({
  isOpen,
  initialTab = 'followers',
  userId,
  onClose,
  onCountsChanged,
}) => {
  const { user } = useAuth();
  const currentUserId = user?.userId ?? null;
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [items, setItems] = useState<FollowerResponse[]>([]);
  const [followingMap, setFollowingMap] = useState<Record<number, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  const loadData = useCallback(async () => {
    if (!userId || !isOpen) return;
    setIsLoading(true);
    try {
      if (activeTab === 'followers') {
        const res = await followerService.getFollowers(userId, 1, 50);
        setItems(res?.items ?? []);
      } else {
        const res = await followerService.getFollowing(userId, 1, 50);
        setItems(res?.items ?? []);
      }

      // Check current user's follow state against all users in the list
      if (currentUserId) {
        const myFollowing = await followerService.getFollowing(currentUserId, 1, 100);
        const map: Record<number, boolean> = {};
        (myFollowing?.items ?? []).forEach((f) => {
          if (f.followedId) map[f.followedId] = true;
        });
        setFollowingMap(map);
      }
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId, isOpen, activeTab, currentUserId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleFollow = async (targetUserId: number) => {
    if (!targetUserId || !currentUserId || targetUserId === currentUserId) return;
    setActionInProgress((prev) => ({ ...prev, [targetUserId]: true }));
    try {
      const isCurrentlyFollowing = Boolean(followingMap[targetUserId]);
      if (isCurrentlyFollowing) {
        await followerService.unfollow(targetUserId);
        setFollowingMap((prev) => ({ ...prev, [targetUserId]: false }));
      } else {
        await followerService.follow({ followedId: targetUserId });
        setFollowingMap((prev) => ({ ...prev, [targetUserId]: true }));
      }
      onCountsChanged?.();
    } catch (err) {
      // Revert / log
    } finally {
      setActionInProgress((prev) => ({ ...prev, [targetUserId]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalTabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'followers' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('followers')}
            >
              Followers
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'following' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('following')}
            >
              Following
            </button>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {isLoading ? (
            <div className={styles.loadingWrapper}>
              <div className={styles.spinner} />
              <span>Loading {activeTab}…</span>
            </div>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>
              <Users size={32} color="#94a3b8" />
              <span>
                {activeTab === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
              </span>
            </div>
          ) : (
            <ul className={styles.userList}>
              {items.map((item) => {
                const targetId = activeTab === 'followers' ? item.followerId : item.followedId;
                const targetName = activeTab === 'followers' ? item.followerName : item.followedName;
                const targetEmail = activeTab === 'followers' ? item.followerEmail : item.followedEmail;
                const avatarColor = PALETTE[(targetId || 1) % PALETTE.length];
                const initials = deriveInitials(targetName);
                const isMe = currentUserId === targetId;
                const isFollowing = Boolean(followingMap[targetId]);
                const isBusy = Boolean(actionInProgress[targetId]);

                return (
                  <li key={item.id ?? `${item.followerId}_${item.followedId}`} className={styles.userItem}>
                    <div className={styles.userInfo}>
                      <div className={styles.userAvatar} style={{ backgroundColor: avatarColor }}>
                        {initials}
                      </div>
                      <div className={styles.userDetails}>
                        <span className={styles.userName}>{targetName || `User #${targetId}`}</span>
                        {targetEmail && <span className={styles.userEmail}>{targetEmail}</span>}
                      </div>
                    </div>

                    {!isMe && currentUserId && (
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${isFollowing ? styles.followingBtn : styles.followBtn}`}
                        onClick={() => void handleToggleFollow(targetId)}
                        disabled={isBusy}
                      >
                        {isBusy ? '…' : isFollowing ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default FollowListModal;

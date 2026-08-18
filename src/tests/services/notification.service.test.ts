/**
 * notificationService tests.
 *
 * Verifies the strict-TS boundary against the live Swagger contract:
 *   GET  /api/Notification            — list
 *   GET  /api/Notification/{id}       — detail
 *   PUT  /api/Notification/{id}       — mark read
 *   DELETE /api/Notification/{id}     — remove
 *   fan-out of PUT                    — mark-all-read (no Swagger endpoint)
 *
 * The service is the only place where DTO normalization happens; every
 * downstream hook/component consumes the strict shape and must not need
 * its own null-checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../services/axios';
import { notificationService } from '../../services/notification.service';

vi.mock('../../services/axios', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApi = api as unknown as {
  get: ReturnType<typeof vi.fn>;
  post: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('calls GET /api/Notification and returns a normalized list', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: [
          { id: 1, userId: 7, message: '[Review] accepted', isRead: false, createdAt: '2026-08-18T00:00:00Z' },
          { id: 2, userId: 7, message: '[Paper] status changed', isRead: true },
        ],
      });

      const list = await notificationService.getAll(7);

      expect(mockedApi.get).toHaveBeenCalledWith('/api/Notification', { params: { userId: 7 } });
      expect(list).toHaveLength(2);
      expect(list[0]).toEqual({
        id: 1,
        userId: 7,
        message: '[Review] accepted',
        isRead: false,
        createdAt: '2026-08-18T00:00:00Z',
      });
    });

    it('returns an empty list when the BE responds with a non-array', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: null });
      const list = await notificationService.getAll();
      expect(list).toEqual([]);
    });

    it('omits the userId param when no userId is supplied', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: [] });
      await notificationService.getAll();
      expect(mockedApi.get).toHaveBeenCalledWith('/api/Notification', { params: undefined });
    });

    it('normalizes missing fields safely', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: [{ id: '5', userId: '3', message: undefined, isRead: 1 }],
      });
      const list = await notificationService.getAll();
      expect(list[0]).toEqual({
        id: 5,
        userId: 3,
        message: '',
        isRead: true,
        createdAt: undefined,
      });
    });
  });

  describe('getById', () => {
    it('returns the normalized row on 200', async () => {
      mockedApi.get.mockResolvedValueOnce({
        data: { id: 9, userId: 2, message: 'hi', isRead: true },
      });
      const row = await notificationService.getById(9);
      expect(row).toEqual({
        id: 9,
        userId: 2,
        message: 'hi',
        isRead: true,
        createdAt: undefined,
      });
      expect(mockedApi.get).toHaveBeenCalledWith('/api/Notification/9');
    });

    it('returns null on 404 (deleted / never existed)', async () => {
      mockedApi.get.mockRejectedValueOnce({
        response: { status: 404 },
      });
      const row = await notificationService.getById(99);
      expect(row).toBeNull();
    });

    it('rethrows on non-404 errors', async () => {
      mockedApi.get.mockRejectedValueOnce(new Error('boom'));
      await expect(notificationService.getById(1)).rejects.toThrow('boom');
    });
  });

  describe('markRead', () => {
    it('sends PUT with { isRead: true }', async () => {
      mockedApi.put.mockResolvedValueOnce({
        data: { id: 1, userId: 7, message: 'x', isRead: true },
      });
      const row = await notificationService.markRead(1);
      expect(mockedApi.put).toHaveBeenCalledWith('/api/Notification/1', { isRead: true });
      expect(row.isRead).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('fans out PUT /api/Notification/{id} for every unread row', async () => {
      mockedApi.put
        .mockResolvedValueOnce({ data: { id: 1, userId: 1, message: 'a', isRead: true } })
        .mockResolvedValueOnce({ data: { id: 2, userId: 1, message: 'b', isRead: true } });
      const { updated, failures } = await notificationService.markAllRead([
        { id: 1, userId: 1, message: 'a', isRead: false },
        { id: 2, userId: 1, message: 'b', isRead: false },
        { id: 3, userId: 1, message: 'c', isRead: true }, // already read, skipped
      ]);
      expect(mockedApi.put).toHaveBeenCalledTimes(2);
      expect(updated).toHaveLength(2);
      expect(failures).toEqual([]);
    });

    it('captures failed ids without throwing', async () => {
      mockedApi.put
        .mockResolvedValueOnce({ data: { id: 1, userId: 1, message: 'a', isRead: true } })
        .mockRejectedValueOnce(new Error('network'));
      const { updated, failures } = await notificationService.markAllRead([
        { id: 1, userId: 1, message: 'a', isRead: false },
        { id: 2, userId: 1, message: 'b', isRead: false },
      ]);
      expect(updated).toHaveLength(1);
      expect(failures).toEqual([2]);
    });

    it('returns empty when there are no unread rows', async () => {
      const { updated, failures } = await notificationService.markAllRead([
        { id: 1, userId: 1, message: 'a', isRead: true },
      ]);
      expect(updated).toEqual([]);
      expect(failures).toEqual([]);
      expect(mockedApi.put).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('sends DELETE /api/Notification/{id}', async () => {
      mockedApi.delete.mockResolvedValueOnce({ status: 200 });
      await notificationService.delete(11);
      expect(mockedApi.delete).toHaveBeenCalledWith('/api/Notification/11');
    });
  });
});

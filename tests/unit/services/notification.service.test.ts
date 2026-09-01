/**
 * notificationService tests.
 *
 * Verifies the strict-TS boundary against the live Swagger contract:
 *   GET  /api/Notification            — list
 *   GET  /api/Notification/{id}       — detail
 *   PUT  /api/Notification/{id}/read  — mark read
 *   PUT  /api/Notification/mark-all-read — mark all read atomically
 *   DELETE /api/Notification/{id}     — remove
 *
 * The service is the only place where DTO normalization happens; every
 * downstream hook/component consumes the strict shape and must not need
 * its own null-checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import api from '../../../src/services/axios';
import { notificationService } from '../../../src/services/notification.service';

vi.mock('../../../src/services/axios', () => ({
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
        notificationId: 1,
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
        notificationId: 5,
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
        notificationId: 9,
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
    it('uses the dedicated mark-read endpoint', async () => {
      mockedApi.put.mockResolvedValueOnce({
        data: { id: 1, userId: 7, message: 'x', isRead: true },
      });
      const row = await notificationService.markRead(1);
      expect(mockedApi.put).toHaveBeenCalledWith('/api/Notification/1/read');
      expect(row.isRead).toBe(true);
    });
  });

  describe('markAllRead', () => {
    it('uses one atomic mark-all-read request', async () => {
      mockedApi.put.mockResolvedValueOnce({ data: null });
      const { updated, failures } = await notificationService.markAllRead([
        { id: 1, userId: 1, message: 'a', isRead: false },
        { id: 2, userId: 1, message: 'b', isRead: false },
        { id: 3, userId: 1, message: 'c', isRead: true }, // already read, skipped
      ]);
      expect(mockedApi.put).toHaveBeenCalledTimes(1);
      expect(mockedApi.put).toHaveBeenCalledWith('/api/Notification/mark-all-read');
      expect(updated).toHaveLength(3);
      expect(updated.every((item) => item.isRead)).toBe(true);
      expect(failures).toEqual([]);
    });

    it('propagates an atomic endpoint failure', async () => {
      mockedApi.put.mockRejectedValueOnce(new Error('network'));
      await expect(notificationService.markAllRead([
        { id: 1, userId: 1, message: 'a', isRead: false },
        { id: 2, userId: 1, message: 'b', isRead: false },
      ])).rejects.toThrow('network');
    });

    it('still calls the atomic endpoint when the local list has no unread rows', async () => {
      mockedApi.put.mockResolvedValueOnce({ data: null });
      const { updated, failures } = await notificationService.markAllRead([
        { id: 1, userId: 1, message: 'a', isRead: true },
      ]);
      expect(updated).toEqual([{ id: 1, userId: 1, message: 'a', isRead: true }]);
      expect(failures).toEqual([]);
      expect(mockedApi.put).toHaveBeenCalledWith('/api/Notification/mark-all-read');
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

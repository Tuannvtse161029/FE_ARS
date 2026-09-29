import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../../../src/utils/storage';
import { useAuthStore } from '../../../src/store/authSlice';
import type { User } from '../../../src/types/auth';

describe('Remember Me & Storage Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.getState().logout();
  });

  it('saves and retrieves remembered email correctly', () => {
    expect(storage.getSavedEmail()).toBe('');

    storage.setSavedEmail('researcher@institution.edu');
    expect(storage.getSavedEmail()).toBe('researcher@institution.edu');

    storage.removeSavedEmail();
    expect(storage.getSavedEmail()).toBe('');
  });

  it('manages rememberMe flag in localStorage', () => {
    expect(storage.getRememberMe()).toBe(false);

    storage.setRememberMe(true);
    expect(storage.getRememberMe()).toBe(true);

    storage.setRememberMe(false);
    expect(storage.getRememberMe()).toBe(false);
  });

  it('persists session in localStorage when Remember Me is enabled', () => {
    storage.setRememberMe(true);

    const mockUser: User = {
      id: 99,
      username: 'test_researcher',
      email: 'researcher@fpt.edu.vn',
      fullName: 'Dr. Test Researcher',
      roleId: 2,
      roleName: 'Researcher',
      isActive: true,
      verificationStatus: 'Accepted',
      accountTier: 'Pro',
    };

    useAuthStore.getState().login(mockUser, 'test-jwt-token-remembered', 'Researcher');

    // Should be saved in localStorage
    const savedLocal = localStorage.getItem('ars-auth-storage');
    expect(savedLocal).not.toBeNull();
    const parsed = JSON.parse(savedLocal!);
    expect(parsed.state.user.id).toBe(99);
    expect(parsed.state.token).toBe('test-jwt-token-remembered');
    expect(parsed.state.isAuthenticated).toBe(true);
  });

  it('persists session only in sessionStorage when Remember Me is disabled', () => {
    storage.setRememberMe(false);

    const mockUser: User = {
      id: 100,
      username: 'temp_user',
      email: 'temp@fpt.edu.vn',
      fullName: 'Temp User',
      roleId: 3,
      roleName: 'Lecturer',
      isActive: true,
      verificationStatus: 'Accepted',
      accountTier: 'Free',
    };

    useAuthStore.getState().login(mockUser, 'test-jwt-token-session', 'Lecturer');

    // Should be saved in sessionStorage, NOT localStorage
    const savedSession = sessionStorage.getItem('ars-auth-storage');
    expect(savedSession).not.toBeNull();
    const parsed = JSON.parse(savedSession!);
    expect(parsed.state.user.id).toBe(100);

    const savedLocal = localStorage.getItem('ars-auth-storage');
    expect(savedLocal).toBeNull();
  });

  // QA report recommendation: add an explicit happy path for the
  // sessionStorage ⇄ localStorage switch driven by Remember Me.
  it('routes encrypted token envelope to localStorage when Remember Me is enabled', async () => {
    const { secureToken } = await import('../../../src/utils/secureToken');
    storage.setRememberMe(true);

    await secureToken.writeAfterLogin('header.payload.sig', null, true);

    const localEnvelope = localStorage.getItem('ars_token_enc_v1');
    const sessionEnvelope = sessionStorage.getItem('ars_token_enc_v1');
    expect(localEnvelope).not.toBeNull();
    // Envelope must NOT contain the cleartext JWT anywhere — that would
    // defeat the Session-2 hardening that lives in secureToken.ts.
    expect(localEnvelope).not.toContain('header.payload.sig');
    expect(sessionEnvelope).toBeNull();
  });

  it('routes encrypted token envelope to sessionStorage when Remember Me is disabled', async () => {
    const { secureToken } = await import('../../../src/utils/secureToken');
    storage.setRememberMe(false);

    await secureToken.writeAfterLogin('header.payload.sig', null, false);

    const localEnvelope = localStorage.getItem('ars_token_enc_v1');
    const sessionEnvelope = sessionStorage.getItem('ars_token_enc_v1');
    expect(sessionEnvelope).not.toBeNull();
    expect(sessionEnvelope).not.toContain('header.payload.sig');
    expect(localEnvelope).toBeNull();
  });

  it('removes the encrypted envelope from the previous bucket when Remember Me toggles', async () => {
    const { secureToken } = await import('../../../src/utils/secureToken');

    storage.setRememberMe(true);
    await secureToken.writeAfterLogin('token.remembered', null, true);
    expect(localStorage.getItem('ars_token_enc_v1')).not.toBeNull();

    // Simulate the next login with Remember Me turned off. The previous
    // envelope should be evicted from localStorage so the user does not
    // end up with two parallel encrypted copies.
    storage.setRememberMe(false);
    await secureToken.writeAfterLogin('token.session-only', null, false);
    expect(sessionStorage.getItem('ars_token_enc_v1')).not.toBeNull();
    expect(localStorage.getItem('ars_token_enc_v1')).toBeNull();
  });

  it('cleans up auth storage upon logout', () => {
    storage.setRememberMe(true);
    const mockUser: User = {
      id: 101,
      username: 'logout_user',
      email: 'logout@fpt.edu.vn',
      fullName: 'Logout User',
      roleId: 2,
      roleName: 'Researcher',
      isActive: true,
    };

    useAuthStore.getState().login(mockUser, 'token-to-be-cleared');
    expect(localStorage.getItem('ars-auth-storage')).not.toBeNull();

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem('ars-auth-storage')).toBeNull();
    expect(sessionStorage.getItem('ars-auth-storage')).toBeNull();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../../../src/utils/storage';
import { useAuthStore } from '../../../src/store/authSlice';
import { secureToken } from '../../../src/utils/secureToken';
import type { User } from '../../../src/types/auth';

const USER_ENVELOPE_KEY = secureToken.KEYS.USER;

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

  it('persists the encrypted user envelope in localStorage when Remember Me is enabled', async () => {
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

    // Login is async now (the envelope write goes through Web Crypto).
    await useAuthStore.getState().login(mockUser, 'test-jwt-token-remembered', 'Researcher');

    // The user projection is now stored as an AES-256-GCM envelope
    // under the dedicated `ars_user_enc_v1` key, NOT as a plaintext
    // `ars-auth-storage` blob. The legacy key must be absent.
    const savedLocal = localStorage.getItem(USER_ENVELOPE_KEY);
    expect(savedLocal).not.toBeNull();
    expect(localStorage.getItem('ars-auth-storage')).toBeNull();

    // Envelope must NOT contain the cleartext PII or token anywhere.
    expect(savedLocal).not.toContain('"email"');
    expect(savedLocal).not.toContain('"fullName"');
    expect(savedLocal).not.toContain('"username"');
    expect(savedLocal).not.toContain('"avatarUrl"');
    expect(savedLocal).not.toContain('test-jwt-token-remembered');
    expect(savedLocal).not.toContain('"token"');

    // Envelope shape: v1 version, opaque iv + ct + iat
    const parsed = JSON.parse(savedLocal!);
    expect(parsed.v).toBe('v1');
    expect(typeof parsed.iv).toBe('string');
    expect(typeof parsed.ct).toBe('string');
    expect(typeof parsed.iat).toBe('number');
  });

  it('persists the encrypted user envelope in sessionStorage when Remember Me is disabled', async () => {
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

    await useAuthStore.getState().login(mockUser, 'test-jwt-token-session', 'Lecturer');

    const savedSession = sessionStorage.getItem(USER_ENVELOPE_KEY);
    expect(savedSession).not.toBeNull();
    expect(sessionStorage.getItem('ars-auth-storage')).toBeNull();

    const savedLocal = localStorage.getItem(USER_ENVELOPE_KEY);
    // Session-3: we write to both buckets so the in-memory key can
    // decrypt either side on rehydrate. The plaintext key is still
    // not present anywhere.
    expect(savedLocal).not.toBeNull();
    expect(savedLocal).not.toContain('"email"');
    expect(savedLocal).not.toContain('"fullName"');
  });

  // QA report recommendation: add an explicit happy path for the
  // sessionStorage ⇄ localStorage switch driven by Remember Me.
  it('routes encrypted token envelope to localStorage when Remember Me is enabled', async () => {
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
    storage.setRememberMe(false);

    await secureToken.writeAfterLogin('header.payload.sig', null, false);

    const localEnvelope = localStorage.getItem('ars_token_enc_v1');
    const sessionEnvelope = sessionStorage.getItem('ars_token_enc_v1');
    expect(sessionEnvelope).not.toBeNull();
    expect(sessionEnvelope).not.toContain('header.payload.sig');
    expect(localEnvelope).toBeNull();
  });

  it('removes the encrypted envelope from the previous bucket when Remember Me toggles', async () => {
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

  it('cleans up the encrypted user envelope upon logout', async () => {
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

    await useAuthStore.getState().login(mockUser, 'token-to-be-cleared');
    expect(localStorage.getItem(USER_ENVELOPE_KEY)).not.toBeNull();

    useAuthStore.getState().logout();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    // The encrypted envelope and the legacy plaintext key are both
    // wiped on logout so a stale blob cannot leak to the next user
    // on a shared browser.
    expect(localStorage.getItem(USER_ENVELOPE_KEY)).toBeNull();
    expect(sessionStorage.getItem(USER_ENVELOPE_KEY)).toBeNull();
    expect(localStorage.getItem('ars-auth-storage')).toBeNull();
    expect(sessionStorage.getItem('ars-auth-storage')).toBeNull();
  });
});
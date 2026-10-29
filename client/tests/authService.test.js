import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiClient } from '../src/services/api-client.js';
import { AuthService } from '../src/services/auth.service.js';

describe('AuthService (Stage 6.2D3)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('getProfile calls GET /auth/me and returns profile data payload', async () => {
    const mockEnvelope = {
      success: true,
      data: {
        id: 'usr-1234',
        email: 'user@example.com',
        displayName: 'Test User',
        currency: 'INR',
        createdAt: '2026-10-01T00:00:00Z',
        lastLoginAt: '2026-10-29T10:00:00Z'
      }
    };

    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(mockEnvelope);

    const result = await AuthService.getProfile();

    expect(getSpy).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual(mockEnvelope.data);
  });

  it('login calls POST /auth/login with credentials and returns authenticated profile', async () => {
    const credentials = {
      email: 'user@example.com',
      password: 'SecurePassword123!'
    };

    const mockEnvelope = {
      success: true,
      data: {
        id: 'usr-1234',
        email: 'user@example.com',
        displayName: 'Test User',
        currency: 'INR'
      }
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockEnvelope);

    const result = await AuthService.login(credentials);

    expect(postSpy).toHaveBeenCalledWith('/auth/login', credentials);
    expect(result).toEqual(mockEnvelope.data);
  });

  it('register calls POST /auth/register with user details and returns created profile', async () => {
    const registrationData = {
      email: 'newuser@example.com',
      password: 'StrongPassword123!',
      displayName: 'New User',
      currency: 'INR'
    };

    const mockEnvelope = {
      success: true,
      data: {
        id: 'usr-5678',
        email: 'newuser@example.com',
        displayName: 'New User',
        currency: 'INR'
      }
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockEnvelope);

    const result = await AuthService.register(registrationData);

    expect(postSpy).toHaveBeenCalledWith('/auth/register', registrationData);
    expect(result).toEqual(mockEnvelope.data);
  });

  it('logout calls POST /auth/logout and returns success message', async () => {
    const mockEnvelope = {
      success: true,
      data: {
        message: 'Logged out successfully.'
      }
    };

    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValueOnce(mockEnvelope);

    const result = await AuthService.logout();

    expect(postSpy).toHaveBeenCalledWith('/auth/logout');
    expect(result).toEqual(mockEnvelope.data);
  });
});

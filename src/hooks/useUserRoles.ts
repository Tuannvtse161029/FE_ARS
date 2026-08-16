import { useEffect, useState } from 'react';
import { userRoleService } from '../services/userRole.service';
import type { UserRoleItem, UserRoleCreateRequest } from '../types/domain';

interface UseUserRolesResult {
  roles: UserRoleItem[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useUserRoles(): UseUserRolesResult {
  const [roles, setRoles] = useState<UserRoleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await userRoleService.getAll();
      setRoles(list);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load user roles'));
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refetch();
  }, []);

  return { roles, isLoading, error, refetch };
}

interface UseAssignRoleResult {
  assign: (data: UserRoleCreateRequest) => Promise<UserRoleItem | null>;
  revoke: (id: number) => Promise<boolean>;
  isLoading: boolean;
  error: Error | null;
}

export function useAssignRole(): UseAssignRoleResult {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const assign = async (data: UserRoleCreateRequest): Promise<UserRoleItem | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await userRoleService.assign(data);
      setIsLoading(false);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to assign role'));
      setIsLoading(false);
      return null;
    }
  };

  const revoke = async (id: number): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      await userRoleService.revoke(id);
      setIsLoading(false);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to revoke role'));
      setIsLoading(false);
      return false;
    }
  };

  return { assign, revoke, isLoading, error };
}

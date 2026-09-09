import { describe, it, expect } from 'vitest';
import type { User } from '../../../src/types/auth';

describe('Multi-Role Membership in Invitation Workflows', () => {
  describe('Research Group Student Roster Filtering', () => {
    const filterGraduateStudents = (userList: User[]): User[] => {
      return userList.filter((u) => {
        const roleName = (u.roleName ?? '').toLowerCase();
        const roleId = typeof u.roleId === 'number' ? u.roleId : -1;
        const hasGraduateRole =
          Array.isArray(u.roles) &&
          u.roles.some((r) => {
            const norm = (r ?? '').toLowerCase().replace(/\s+/g, '');
            return norm === 'graduatestudent';
          });
        return (
          hasGraduateRole ||
          roleName === 'graduate student' ||
          roleName === 'graduatestudent' ||
          roleId === 5
        );
      });
    };

    it('retains Alex when Alex holds both Graduate Student and Researcher roles, even if primary roleName is Researcher', () => {
      const alex: User = {
        id: 25,
        username: 'alex',
        fullName: 'Alex Graduate',
        email: 'gradstudent@arsplatform.com',
        roleId: 1,
        roleName: 'Researcher',
        roles: ['Graduate Student', 'Researcher'],
        isActive: true,
      };

      const roster = filterGraduateStudents([alex]);
      expect(roster).toHaveLength(1);
      expect(roster[0].id).toBe(25);
      expect(roster[0].roles).toContain('Graduate Student');
      expect(roster[0].roles).toContain('Researcher');
    });

    it('handles space-collapsed GraduateStudent in roles array', () => {
      const student: User = {
        id: 26,
        username: 'student2',
        fullName: 'Student Two',
        email: 'student2@example.com',
        roleId: 1,
        roleName: 'Researcher',
        roles: ['GraduateStudent' as any, 'Researcher'],
        isActive: true,
      };

      const roster = filterGraduateStudents([student]);
      expect(roster).toHaveLength(1);
      expect(roster[0].id).toBe(26);
    });

    it('excludes users who only hold Researcher or Lecturer roles without Graduate Student membership', () => {
      const pureResearcher: User = {
        id: 30,
        username: 'res',
        fullName: 'Pure Researcher',
        email: 'researcher@example.com',
        roleId: 1,
        roleName: 'Researcher',
        roles: ['Researcher'],
        isActive: true,
      };

      const pureLecturer: User = {
        id: 31,
        username: 'lec',
        fullName: 'Dr. Lecturer',
        email: 'lecturer@example.com',
        roleId: 4,
        roleName: 'Lecturer',
        roles: ['Lecturer'],
        isActive: true,
      };

      const roster = filterGraduateStudents([pureResearcher, pureLecturer]);
      expect(roster).toHaveLength(0);
    });

    it('retains standard single-role Graduate Student accounts', () => {
      const singleRoleStudent: User = {
        id: 32,
        username: 'student3',
        fullName: 'Standard Student',
        email: 'student3@example.com',
        roleId: 5,
        roleName: 'Graduate Student',
        roles: ['Graduate Student'],
        isActive: true,
      };

      const roster = filterGraduateStudents([singleRoleStudent]);
      expect(roster).toHaveLength(1);
      expect(roster[0].id).toBe(32);
    });
  });

  describe('Seminar Invitee Role Resolution and Formatting', () => {
    const formatRoleLabel = (roleName: string, isVi: boolean): string => {
      const trimmed = (roleName || '').trim();
      const lower = trimmed.toLowerCase().replace(/\s+/g, '');
      const copy = (en: string, vi: string) => (isVi ? vi : en);
      if (lower === 'graduatestudent') {
        return copy('Graduate Student', 'Học viên sau đại học');
      }
      if (lower === 'researcher') {
        return copy('Researcher', 'Nhà nghiên cứu');
      }
      if (lower === 'lecturer') {
        return copy('Lecturer', 'Giảng viên');
      }
      if (lower === 'reviewer') {
        return copy('Reviewer', 'Người phản biện');
      }
      if (lower === 'admin' || lower === 'administrator') {
        return copy('Administrator', 'Quản trị viên');
      }
      if (lower === 'scholar') {
        return copy('Scholar', 'Học giả');
      }
      if (lower === 'colleague') {
        return copy('Colleague', 'Đồng nghiệp');
      }
      return trimmed;
    };

    const resolveCandidateRolesToRender = (inv: { roles?: string[]; role?: string }): string[] => {
      const rolesList = (inv.roles && inv.roles.length > 0)
        ? inv.roles
        : (inv.role ? inv.role.split(' • ').map((s) => s.trim()).filter(Boolean) : []);
      if (rolesList.length === 0) {
        rolesList.push('Colleague');
      }
      return rolesList;
    };

    it('resolves and formats multi-role candidate in English without blank labels', () => {
      const candidate = {
        userId: 25,
        fullName: 'Alex Graduate',
        email: 'gradstudent@arsplatform.com',
        roles: ['Graduate Student', 'Researcher'],
        role: 'Graduate Student • Researcher',
      };

      const roles = resolveCandidateRolesToRender(candidate);
      expect(roles).toEqual(['Graduate Student', 'Researcher']);

      const formatted = roles.map((r) => formatRoleLabel(r, false));
      expect(formatted).toEqual(['Graduate Student', 'Researcher']);
      expect(formatted.join(' • ')).toBe('Graduate Student • Researcher');
    });

    it('resolves and formats multi-role candidate in Vietnamese', () => {
      const candidate = {
        userId: 25,
        fullName: 'Alex Graduate',
        email: 'gradstudent@arsplatform.com',
        roles: ['Graduate Student', 'Researcher'],
        role: 'Graduate Student • Researcher',
      };

      const roles = resolveCandidateRolesToRender(candidate);
      const formattedVi = roles.map((r) => formatRoleLabel(r, true));
      expect(formattedVi).toEqual(['Học viên sau đại học', 'Nhà nghiên cứu']);
      expect(formattedVi.join(' • ')).toBe('Học viên sau đại học • Nhà nghiên cứu');
    });

    it('resolves single-role candidates correctly', () => {
      const reviewer = {
        userId: 151,
        fullName: 'Dr. Tue',
        email: 'reviewer@arsplatform.com',
        roles: ['Reviewer'],
        role: 'Reviewer',
      };

      const roles = resolveCandidateRolesToRender(reviewer);
      expect(roles).toEqual(['Reviewer']);
      expect(formatRoleLabel(roles[0], false)).toBe('Reviewer');
      expect(formatRoleLabel(roles[0], true)).toBe('Người phản biện');
    });

    it('never leaves a candidate with a blank label', () => {
      const blankCandidate = {
        userId: 999,
        fullName: 'No Role User',
        email: 'norole@example.com',
        roles: [],
        role: '',
      };

      const roles = resolveCandidateRolesToRender(blankCandidate);
      expect(roles).toHaveLength(1);
      expect(roles[0]).toBe('Colleague');
      expect(formatRoleLabel(roles[0], false)).toBe('Colleague');
      expect(formatRoleLabel(roles[0], true)).toBe('Đồng nghiệp');
    });
  });
});

/**
 * Role credentials — read from env vars ONLY. The helper throws when
 * a credential is missing instead of falling back to a hardcoded value.
 *
 * No credential is ever echoed to stdout / stderr / a screenshot. The
 * test failure message intentionally identifies the missing key by
 * NAME so the operator can fix the local file.
 */

export type RoleName =
  | 'admin'
  | 'researcher'
  | 'lecturer'
  | 'gradstudent'
  | 'reviewer';

interface RoleCreds {
  email: string;
  password: string;
}

function readRequired(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `[credentials] Missing env var: ${name}. Fill it into .env.playwright.local.`,
    );
  }
  return value;
}

function readOptional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function getCredentials(role: RoleName): RoleCreds {
  const upper = role.toUpperCase();
  return {
    email: readRequired(`PW_${upper}_EMAIL`),
    password: readRequired(`PW_${upper}_PASSWORD`),
  };
}

export function getTestRunPrefix(): string {
  return (
    readOptional('PW_TEST_RUN_PREFIX') ??
    `ARS-E2E-${new Date().toISOString().slice(0, 19).replace(/[:T-]/g, '')}`
  );
}
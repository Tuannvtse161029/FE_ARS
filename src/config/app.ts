export const AppConfig = {
  appName: 'ARS Platform',
  appVersion: '1.0.0',
  description: 'Academic Research System - Manage and share research papers',
  features: {
    enableRegistration: true,
    enableORCID: true,
    enablePaperSubmission: true,
  },
};

export const AuthConfig = {
  tokenKey: 'ars_token',
  userKey: 'ars_user',
  tokenExpirationHours: 24,
};

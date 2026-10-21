export type LegalDocId = 'userAgreement' | 'privacyPolicy' | 'sdkList' | 'openSource';

export type AuthStackParams = {
  Onboarding: undefined;
  Login: { region?: string } | undefined;
  Register: { region?: string } | undefined;
  RegionSelect: { selected?: string; returnTo: 'Login' | 'Register' };
  ForgotPassword: { email?: string } | undefined;
  LegalDocument: { docId: LegalDocId };
};

// Stack behind the Home tab (device-centric flows).
export type DeviceStackParams = {
  Home: undefined;
  DeviceControl: { deviceId: string };
  DeviceSettings: { deviceId: string };
  AddDevice: undefined;
  RoomManagement: undefined;
  Messages: undefined;
  Help: undefined;
};

export type ProfileStackParams = {
  ProfileHub: undefined;
  Settings: undefined;
};

export type MainTabParams = {
  HomeTab: undefined;
  ACTab: undefined;
  ProfileTab: undefined;
};

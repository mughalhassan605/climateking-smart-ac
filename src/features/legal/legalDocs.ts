// Bundled copies of the legal documents (original module 1748). The screen prefers the
// server version from /legal/documents/:id and shows these while it loads or when offline.
import type { LegalDocId } from '../../navigation/types';

export type LegalSection = { heading?: string; body: string };
export type LegalDocument = { id: LegalDocId; title: string; updated: string; sections: LegalSection[] };

export const LEGAL_DOCS: Record<LegalDocId, LegalDocument> = {
  "userAgreement": {
    "id": "userAgreement",
    "title": "User Agreement",
    "updated": "Updated 12 Mar 2026",
    "sections": [
      {
        "body": "Welcome to Climate King. By creating an account and using the app you agree to the terms below. Please read them carefully."
      },
      {
        "heading": "1. Using the app",
        "body": "Climate King lets you monitor and control compatible air-conditioning devices. You are responsible for keeping your account credentials secure and for activity that happens under your account."
      },
      {
        "heading": "2. Your devices",
        "body": "You may only connect devices you own or are authorised to control. Some features depend on your home network and the device firmware version."
      },
      {
        "heading": "3. Acceptable use",
        "body": "Do not misuse the service, attempt to disrupt it, or use it in any way that breaks applicable laws. We may suspend accounts that violate these terms."
      }
    ]
  },
  "privacyPolicy": {
    "id": "privacyPolicy",
    "title": "Privacy Policy",
    "updated": "Updated 12 Mar 2026",
    "sections": [
      {
        "body": "This policy explains what information Climate King collects, how we use it, and the choices you have."
      },
      {
        "heading": "What we collect",
        "body": "Account details (such as your email), device data needed to provide control and automation, and basic usage analytics that help us improve the app."
      },
      {
        "heading": "How we use it",
        "body": "To operate your devices, keep your account secure, respond to support requests, and improve our features. We do not sell your personal information."
      },
      {
        "heading": "Your choices",
        "body": "You can export your data, revoke consent, or delete your account at any time from Settings → Account and security."
      }
    ]
  },
  "sdkList": {
    "id": "sdkList",
    "title": "Third-party services",
    "updated": "Updated 12 Mar 2026",
    "sections": [
      {
        "body": "Climate King relies on a small number of third-party services to function. Each receives only the data needed for its purpose."
      },
      {
        "heading": "Push notifications",
        "body": "Used to deliver alerts about your devices. Receives a device push token."
      },
      {
        "heading": "Crash & performance analytics",
        "body": "Used to detect and fix issues. Receives anonymised diagnostic data."
      },
      {
        "heading": "Voice assistants",
        "body": "If you link Amazon Alexa or Google Assistant, limited device state is shared to enable voice control."
      }
    ]
  },
  "openSource": {
    "id": "openSource",
    "title": "Open-source licenses",
    "updated": "",
    "sections": [
      {
        "body": "Climate King is built with the help of open-source software. We are grateful to the maintainers of these projects."
      },
      {
        "heading": "React Native · MIT",
        "body": "Copyright © Meta Platforms, Inc. and affiliates."
      },
      {
        "heading": "React Navigation · MIT",
        "body": "Copyright © React Navigation contributors."
      },
      {
        "heading": "TanStack Query · MIT",
        "body": "Copyright © Tanner Linsley."
      }
    ]
  }
};

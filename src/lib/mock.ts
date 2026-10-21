import { env } from '../config/env';

// Demo-mode helper mirroring the original mockRequest (module 1245): resolves after a short
// delay so loading states render the same way they do against the real server.
export class MockError extends Error {
  constructor(label: string) {
    super(`Couldn’t ${label}. Please try again.`);
    this.name = 'MockError';
  }
}

export async function mockRequest<T>(label: string, fn: () => T): Promise<T> {
  await new Promise<void>(r => setTimeout(() => r(), env.MOCK_LATENCY_MS));
  try {
    const value = fn();
    return typeof value === 'object' && value !== null ? JSON.parse(JSON.stringify(value)) : value;
  } catch (e) {
    throw e instanceof Error ? e : new MockError(label);
  }
}

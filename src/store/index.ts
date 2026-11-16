import type { Store } from '../types';
import { createLocalStore } from './local';
import { createRemoteStore } from './remote';

declare global {
  interface Window {
    BGS_API_URL?: string;
  }
}

/** Có địa chỉ Apps Script trong config.js thì dùng Google Sheets, không thì chạy bản demo. */
export const store: Store = window.BGS_API_URL ? createRemoteStore(window.BGS_API_URL) : createLocalStore();
export { onBusy } from './remote';

import { openDB, type DBSchema, type IDBPDatabase } from "idb";

// أنواع عناصر طابور الإرسال (Outbox) — كلّها عمليات كتابةٍ ميدانية idempotent خادميًّا.
export type OutboxKind = "daily_entry" | "women_activity" | "lesson" | "student" | "media" | "tahfeez_daily";

export interface OutboxItem {
  id: string;            // = clientUuid الثابت (يُعاد إرساله بأمان)
  kind: OutboxKind;
  payload: unknown;      // حمولة الـserverFn
  blob?: Blob;           // للصور (kind=media)
  filename?: string;
  createdAt: number;
  tries: number;
  lastError?: string;
}

interface MishkatDB extends DBSchema {
  outbox: { key: string; value: OutboxItem };
}

let _db: Promise<IDBPDatabase<MishkatDB>> | null = null;

export function offlineDb() {
  if (typeof indexedDB === "undefined") return null;
  if (!_db) {
    _db = openDB<MishkatDB>("mishkat-offline", 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains("outbox")) d.createObjectStore("outbox", { keyPath: "id" });
      },
    });
  }
  return _db;
}

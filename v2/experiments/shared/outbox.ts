/**
 * طابورُ الإرسال (Outbox) — **مشتركٌ بين المرشّحَين عمداً** (ت-٨، ب-٢٣).
 *
 * وجودُه في القياس ضرورة إنصاف: الأوفلاين مطلبٌ معتمد، وكلفتُه واحدةٌ لأنه منطقُ متصفحٍ
 * نقيّ لا علاقةَ له بالإطار — فإن حُسب لأحدهما وحده انحرف القياس. وهو مُصغَّرٌ عن الأصل
 * المواصَف (بلا Web Locks ولا تصنيفِ خطأٍ دائم/عابر) لأن غرضَه القياسُ لا التشغيل.
 */

const DB_NAME = "mishkat-outbox"
const STORE = "queue"

export type OutboxItem = {
  readonly clientUuid: string
  readonly kind: string
  readonly payload: Readonly<Record<string, string>>
  readonly queuedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "clientUuid" })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueue(item: OutboxItem): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite")
    tx.objectStore(STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}

export async function pending(): Promise<readonly OutboxItem[]> {
  const db = await openDb()
  const items = await new Promise<OutboxItem[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly")
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve(req.result as OutboxItem[])
    req.onerror = () => reject(req.error)
  })
  db.close()
  return items
}

/** الإرسالُ بالترتيب الزمنيّ؛ الفشلُ يُعلَن ولا يُبتلَع (ت-٨). */
export async function flush(send: (item: OutboxItem) => Promise<boolean>): Promise<number> {
  const items = [...(await pending())].sort((a, b) => a.queuedAt - b.queuedAt)
  let sent = 0
  for (const item of items) {
    const ok = await send(item)
    if (!ok) break
    sent += 1
  }
  return sent
}

/** ربطُ أزرار الشاشة بالطابور — نقطةُ التفاعل الوحيدة في الشاشة البرهانية. */
export function wireOutboxButtons(root: ParentNode): void {
  for (const el of root.querySelectorAll("[data-capability='dailyLog.edit']")) {
    el.addEventListener("click", () => {
      void enqueue({
        clientUuid: crypto.randomUUID(),
        kind: "dailyLog.edit",
        payload: { scope: document.documentElement.lang },
        queuedAt: Date.now(),
      })
    })
  }
}

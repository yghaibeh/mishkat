// محرّكُ الدفتر المزدوج (المرحلة ٠) — القلبُ المحاسبيُّ الخفيّ.
// كلُّ مبلغٍ بالسنتات الصحيحة (integer). كلُّ قيدٍ متوازنٌ (Σمدين = Σدائن). القيودُ لا تُعدَّل ولا تُحذَف —
// التصحيحُ بقيدٍ عكسيّ. المستخدمُ لا يرى هذا أبدًا؛ يراه النظامُ فقط ليُخرج تقاريرَ صحيحة.
import { and, eq, sql } from 'drizzle-orm'
import { accounts, funds, fiscalPeriods, journalEntries, journalLines } from '../database/schema'
import type { Db } from '../utils/db'

export interface JournalLineInput {
  accountId: string
  fundId: string
  debit?: number   // بالسنتات (بعملة الأساس USD)
  credit?: number  // بالسنتات (بعملة الأساس USD)
  currency?: string     // العملةُ الأصليّة (NULL/USD = الأساس)
  amountOrig?: number   // مقدارُ العملة الأصليّة بوحدتها الصغرى (موجب)
  unitId?: string       // ٠٠٧٣ «الصندوق»: وحدةُ السطر — رصيدُ صندوق كلّ وحدةٍ يُشتقّ من هذا البُعد
}
export interface JournalInput {
  entryDate?: number
  dateHijri?: string
  memo?: string
  source?: string
  sourceRef?: string
  createdBy?: string
}

// تحويلٌ للسنتات (نقطةُ الحدّ الوحيدة بين الواجهة بالدولار والدفتر بالسنتات)
export function toCents(dollars: number): number { return Math.round(dollars * 100) }
export function fromCents(cents: number): number { return cents / 100 }

// ترحيلُ قيدٍ متوازنٍ ذرّيًّا. يرمي عند اختلال التوازن أو فترةٍ مغلقةٍ أو حسابٍ/صندوقٍ غير معروف.
export async function postJournal(db: Db, input: JournalInput, lines: JournalLineInput[]): Promise<{ id: string }> {
  if (lines.length < 2) throw new Error('القيد يحتاج سطرين على الأقلّ')
  let totalDebit = 0, totalCredit = 0
  for (const l of lines) {
    const d = Math.max(0, Math.round(l.debit ?? 0))
    const c = Math.max(0, Math.round(l.credit ?? 0))
    if (d > 0 && c > 0) throw new Error('السطرُ إمّا مدينٌ أو دائنٌ لا كلاهما')
    if (d === 0 && c === 0) throw new Error('سطرٌ بلا مبلغ')
    totalDebit += d; totalCredit += c
  }
  if (totalDebit !== totalCredit) throw new Error(`قيدٌ غير متوازن (مدين ${totalDebit} ≠ دائن ${totalCredit})`)
  if (totalDebit === 0) throw new Error('قيدٌ بمبلغٍ صفريّ')

  const now = input.entryDate ?? Date.now()
  // منعُ القيد في فترةٍ مغلقة
  const closed = (await db.select().from(fiscalPeriods).where(and(
    eq(fiscalPeriods.status, 'closed'), sql`${fiscalPeriods.startsAt} <= ${now}`, sql`${fiscalPeriods.endsAt} >= ${now}`,
  )).all())[0]
  if (closed) throw new Error(`الفترةُ الماليّة «${closed.name}» مقفلة — لا قيدَ فيها`)

  // التحقّقُ من وجود الحسابات والصناديق (فلا سطرٌ يشير لمجهول)
  const accIds = [...new Set(lines.map((l) => l.accountId))]
  const fundIds = [...new Set(lines.map((l) => l.fundId))]
  const knownAcc = new Set((await db.select({ id: accounts.id }).from(accounts).all()).map((a) => a.id))
  const knownFund = new Set((await db.select({ id: funds.id }).from(funds).all()).map((f) => f.id))
  for (const l of lines) {
    if (!knownAcc.has(l.accountId)) throw new Error(`حسابٌ غير معروف: ${l.accountId}`)
    if (!knownFund.has(l.fundId)) throw new Error(`صندوقٌ غير معروف: ${l.fundId}`)
  }

  const id = crypto.randomUUID()
  const stmts: unknown[] = [
    db.insert(journalEntries).values({
      id, entryDate: now, dateHijri: input.dateHijri ?? null, memo: input.memo ?? null,
      source: input.source ?? 'manual', sourceRef: input.sourceRef ?? null, reversalOf: null,
      createdBy: input.createdBy ?? null, createdAt: Date.now(),
    }),
    ...lines.map((l) => db.insert(journalLines).values({
      id: crypto.randomUUID(), entryId: id, accountId: l.accountId, fundId: l.fundId,
      unitId: l.unitId ?? null,
      debitCents: Math.max(0, Math.round(l.debit ?? 0)), creditCents: Math.max(0, Math.round(l.credit ?? 0)),
      currency: l.currency && l.currency !== 'USD' ? l.currency : null,
      amountOrig: l.currency && l.currency !== 'USD' && l.amountOrig != null ? Math.max(0, Math.round(l.amountOrig)) : null,
    })),
  ]
  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0]) // ذرّيّة: القيدُ وسطورُه معًا أو لا شيء
  return { id }
}

// قيدٌ عكسيٌّ يُلغي أثرَ قيدٍ سابقٍ (بدل الحذف — نزاهةُ الدفتر)
export async function reverseJournal(db: Db, entryId: string, createdBy?: string): Promise<{ id: string }> {
  const orig = (await db.select().from(journalEntries).where(eq(journalEntries.id, entryId)).all())[0]
  if (!orig) throw new Error('القيدُ غير موجود')
  const origLines = await db.select().from(journalLines).where(eq(journalLines.entryId, entryId)).all()
  const id = crypto.randomUUID()
  const now = Date.now()
  const stmts: unknown[] = [
    db.insert(journalEntries).values({
      id, entryDate: now, dateHijri: orig.dateHijri, memo: `عكسُ: ${orig.memo ?? ''}`,
      source: 'reversal', sourceRef: orig.sourceRef, reversalOf: entryId, createdBy: createdBy ?? null, createdAt: now,
    }),
    ...origLines.map((l) => db.insert(journalLines).values({
      id: crypto.randomUUID(), entryId: id, accountId: l.accountId, fundId: l.fundId,
      debitCents: l.creditCents, creditCents: l.debitCents, // عكسُ المدين والدائن
    })),
  ]
  await db.batch(stmts as unknown as Parameters<typeof db.batch>[0])
  return { id }
}

// هل لهذا الحدث (source, ref) قيدٌ «نشطٌ» (مُرحَّلٌ ولم يُعكَس)؟ — أساسُ الـidempotency والمزامنة.
export async function hasActivePosting(db: Db, source: string, ref: string): Promise<boolean> {
  const entries = await db.select({ id: journalEntries.id, reversalOf: journalEntries.reversalOf })
    .from(journalEntries).where(and(eq(journalEntries.source, source), eq(journalEntries.sourceRef, ref))).all()
  const reversedIds = new Set(entries.map((e) => e.reversalOf).filter(Boolean) as string[])
  return entries.some((e) => !e.reversalOf && !reversedIds.has(e.id)) // قيدٌ أصليٌّ لم يُعكَس
}

// عكسُ القيد النشط لحدثٍ (source, ref) إن وُجد — يُستعمل قبل إعادة الترحيل عند تعديل الحدث.
export async function reverseByRef(db: Db, source: string, ref: string, createdBy?: string): Promise<{ id: string } | null> {
  const entries = await db.select().from(journalEntries)
    .where(and(eq(journalEntries.source, source), eq(journalEntries.sourceRef, ref))).all()
  const reversedIds = new Set(entries.map((e) => e.reversalOf).filter(Boolean) as string[])
  const active = entries.find((e) => !e.reversalOf && !reversedIds.has(e.id))
  if (!active) return null
  return reverseJournal(db, active.id, createdBy)
}

// ميزانُ المراجعة: لكلّ حسابٍ مجموعُ المدين والدائن والرصيد (بالسنتات). Σأرصدة = 0 دومًا (برهانُ السلامة).
export async function trialBalance(db: Db): Promise<Array<{ accountId: string; name: string; type: string; debit: number; credit: number; balance: number }>> {
  const accs = await db.select().from(accounts).where(eq(accounts.active, true)).all()
  const sums = await db.select({
    accountId: journalLines.accountId,
    debit: sql<number>`coalesce(sum(${journalLines.debitCents}),0)`,
    credit: sql<number>`coalesce(sum(${journalLines.creditCents}),0)`,
  }).from(journalLines).groupBy(journalLines.accountId).all()
  const byAcc = new Map(sums.map((s) => [s.accountId, s]))
  return accs
    .filter((a) => !accs.some((c) => c.parentId === a.id)) // الحساباتُ الورقيّة فقط (لا الأمّهات التجميعيّة)
    .map((a) => {
      const s = byAcc.get(a.id)
      const debit = s?.debit ?? 0, credit = s?.credit ?? 0
      const balance = a.normalBalance === 'debit' ? debit - credit : credit - debit
      return { accountId: a.id, name: a.name, type: a.type, debit, credit, balance }
    })
    .filter((r) => r.debit !== 0 || r.credit !== 0)
}

// رصيدُ صندوقٍ = صافي أصوله (Σ(مدينُ الأصول/المصروف − دائنها) بالإشارة الصحيحة عبر حساباته).
// عمليًّا: رصيدُ الصندوق = إيراداتُه − مصروفاتُه + تحويلاتُه (صافي الأصول لكلّ صندوق).
export async function fundBalances(db: Db): Promise<Array<{ fundId: string; name: string; restricted: boolean; balance: number }>> {
  const fs = await db.select().from(funds).where(eq(funds.active, true)).orderBy(funds.sortOrder).all()
  // صافي الأصول لكلّ صندوق = Σ(دائن الإيراد + مدين الأصل) − Σ(مدين المصروف + دائن الأصل) …
  // نحسبه ببساطة: رصيدُ النقد المنسوبُ للصندوق = Σمدين − Σدائن على حسابات الأصول لهذا الصندوق.
  const rows = await db.select({
    fundId: journalLines.fundId,
    type: accounts.type,
    debit: sql<number>`coalesce(sum(${journalLines.debitCents}),0)`,
    credit: sql<number>`coalesce(sum(${journalLines.creditCents}),0)`,
  }).from(journalLines).innerJoin(accounts, eq(accounts.id, journalLines.accountId))
    .groupBy(journalLines.fundId, accounts.type).all()
  const balByFund = new Map<string, number>()
  for (const r of rows) {
    // الأصولُ: مدين−دائن يزيد الرصيد؛ الخصوم تُنقص؛ صافي الأصول = أصول−خصوم (نتبع أرصدة الأصول والخصوم)
    if (r.type === 'asset') balByFund.set(r.fundId, (balByFund.get(r.fundId) ?? 0) + (r.debit - r.credit))
    else if (r.type === 'liability') balByFund.set(r.fundId, (balByFund.get(r.fundId) ?? 0) - (r.credit - r.debit))
  }
  return fs.map((f) => ({ fundId: f.id, name: f.name, restricted: f.restricted, balance: balByFund.get(f.id) ?? 0 }))
}

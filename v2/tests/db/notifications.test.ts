/**
 * **استمرارُ الإشعارات على D1** — T26-ب-٢ (الاختبارات الإلزامية ١…٩ + الحوافّ).
 *
 * فخُّ هذه الوحدة **معلنٌ ومُقاس**: «أُرسل/قُرئ/سُلِّم» **حالةٌ صريحةٌ على الصفّ نفسِه لا
 * حذفٌ من طابور** (ق-٨٠ في ثوبٍ جديد). فالطابورُ وسطورُ التسليم ملحقةٌ فقط، وانتقالُ الحالة
 * تحديثٌ يُبقي الصفَّ نفسَه — يُبرهَن هنا **على المستودع الحقيقيّ** لا على الذاكرة.
 */

import { describe, expect, it } from "vitest"
import { persistentNotifications } from "../../src/db/repositories/notificationsRepository.js"
import { UnitOfWork } from "../../src/db/unitOfWork.js"
import type { SqlStatement } from "../../src/db/sql/driver.js"
import { NotificationStore } from "../../src/features/notifications/data/store.js"
import { drainQueue } from "../../src/features/notifications/services/queue.js"
import { markRead, myNotifications } from "../../src/features/notifications/services/inbox.js"
import { linkChannel, startTelegramLink } from "../../src/features/notifications/services/channels.js"
import {
  myAnnouncements,
  publishAnnouncement,
} from "../../src/features/notifications/services/announcements.js"
import {
  BILAL_PATH,
  MAIN,
  NOW,
  OTHER,
  SQUARE_LAYER_TARGETS,
  freshNotificationStore,
  freshDb,
  intake,
  notifyCtx,
  notificationsSession,
  payload,
  personEvent,
  rowsOf,
  seedNotificationRefs,
  seedNotificationsSession,
  submissionEvent,
} from "./_notifications.js"

/** قراءةُ عبارات المصدر مقابل أساسه — بها يُقاس **ما يُكتب** لا ما يُقرأ. */
async function statementsAfter(
  driver: Awaited<ReturnType<typeof freshDb>>,
  tenantId: string,
  fn: (store: NotificationStore) => void,
): Promise<readonly SqlStatement[]> {
  const store = freshNotificationStore(tenantId)
  const source = persistentNotifications(store)
  const uow = new UnitOfWork(driver, { tenantId, scopePath: "/" })
  uow.enlist(source)
  await uow.hydrate()
  fn(store)
  return uow.statementsFor(source.name, source.project())
}

/** يُدرِج حدثَ الطبقة الأقرب (مستهدَفاه في العالم القانونيّ اثنان) — البابُ المعلن لا الحقن. */
function submitToSquare(store: NotificationStore): void {
  const done = intake(store, notifyCtx("u-amir"), submissionEvent())
  if (!done.ok) throw new Error(`تعذّر الإدراج: ${done.error.code}`)
}

// ═══ الاختبار الإلزاميّ ١ — لا محو: الطابورُ ملحقٌ، والحالةُ تحديثٌ ═══════════════

describe("ق-٧٥/ت-٨ — «أُرسل/قُرئ» تحديثٌ لا حذفٌ من طابور", () => {
  it("محوُ إشعارٍ من الإسقاط **يُرمى**، ولا `DELETE` يُولَّد على الطابور", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, submitToSquare)

    const store = freshNotificationStore(MAIN)
    const source = persistentNotifications(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()

    const forged = new Map(source.project())
    forged.set("notification_queue", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/notification_queue/)
    driver.close()
  })

  it("ومحوُ سطرِ تسليمٍ كذلك يُرمى — الفشلُ يُعلَن ولا يُبتلع بمحو", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, submitToSquare)

    const store = freshNotificationStore(MAIN)
    const source = persistentNotifications(store)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist(source)
    await uow.hydrate()

    const forged = new Map(source.project())
    forged.set("notification_deliveries", new Map())
    expect(() => uow.statementsFor(source.name, forged)).toThrow(/notification_deliveries/)
    driver.close()
  })

  it("قراءةُ الإشعار **تحديثٌ على الصفّ نفسِه**: صفٌّ واحدٌ يبقى، ومعرّفُه لا يتبدّل", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, submitToSquare)
    const before = (await rowsOf(driver, "notification_queue")) as readonly Record<string, unknown>[]
    expect(before).toHaveLength(2)

    const statements = await statementsAfter(driver, MAIN, (store) => {
      const done = markRead(store, notifyCtx("u-granted"), { notificationId: "ntf-1" })
      expect(done.ok).toBe(true)
    })
    // **عبارةٌ واحدةٌ على الطابور، وهي تحديثٌ بالمفتاح الطبيعيّ** — لا حذفٌ ولا إدراجٌ ثانٍ.
    const onQueue = statements.filter((s) => s.sql.includes("notification_queue"))
    expect(onQueue).toHaveLength(1)
    expect(onQueue[0]!.sql).toContain("ON CONFLICT (tenant_id, id) DO UPDATE")

    await notificationsSession(driver, MAIN, (store) => {
      expect(markRead(store, notifyCtx("u-granted"), { notificationId: "ntf-1" }).ok).toBe(true)
    })
    const after = (await rowsOf(driver, "notification_queue")) as readonly Record<string, unknown>[]
    // **الصفُّ نفسُه بقي**: العددُ اثنان (لم يزد)، و`ntf-1` صار `read` بختمٍ لا بصفٍّ جديد.
    expect(after).toHaveLength(2)
    const read = after.find((r) => r["id"] === "ntf-1")!
    expect(read["status"]).toBe("read")
    expect(read["read_at"]).toBe(NOW.getTime())
    driver.close()
  })

  it("تصريفُ الطابور **يحدّث سطرَ التسليم في مكانه** — ولا عبارةَ حذفٍ مهما تعاقبت الحالات", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    const statements = await statementsAfter(driver, MAIN, (store) => {
      // شخصٌ واحدٌ، حمولةٌ بمبلغ، ثم تصريفٌ ينجح على الجرس ويفشل على تيليغرام —
      // أشدُّ ما يُغري بنمذجة «سُلِّم» و«فشل» حذفاً من طابور.
      const linked = seedLinkedTelegram(store, "u-square")
      expect(linked).toBe(true)
      const done = intake(store, notifyCtx("u-amir"), personEvent("u-square"))
      expect(done.ok).toBe(true)
      drainQueue(store, { bell: () => true, telegram: () => false })
    })
    expect(statements.filter((s) => /^DELETE/.test(s.sql))).toEqual([])
    driver.close()
  })
})

/** يربط تيليغرام لشخصٍ عبر البابين المعلنين (رمزٌ ثم ربط) — لا حقنٌ في المستودع. */
function seedLinkedTelegram(store: NotificationStore, personId: string): boolean {
  const link = startTelegramLink(store, notifyCtx(personId))
  if (!link.ok) return false
  const done = linkChannel(store, notifyCtx(personId), {
    channel: "telegram",
    externalId: `tg-${personId}`,
    token: link.value.token,
  })
  return done.ok
}

// ═══ الاختبار الإلزاميّ ٢/٣ — عزلُ الشبكة والنطاق على المستودع الحقيقيّ ═══════════

describe("قب-١٨/ح-٥ — عزلُ الشبكة والنطاق **على المستودع الحقيقيّ**", () => {
  it("عزلُ الشبكة: طابورُ شبكةٍ **لا يُقرأ** من أخرى ولو تطابق المسارُ حرفياً", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await seedNotificationsSession(driver, OTHER)
    await notificationsSession(driver, OTHER, (store) => {
      const done = intake(store, notifyCtx("u-amir"), personEvent("u-square"))
      expect(done.ok).toBe(true)
    })

    await notificationsSession(driver, MAIN, (store) => {
      expect(store.notifications()).toEqual([])
      expect(store.deliveries()).toEqual([])
      expect(myNotifications(store, notifyCtx("u-square")).unreadCount).toBe(0)
    })
    driver.close()
  })

  it("عزلُ الشبكة: كتابةُ شبكةٍ لا تمسّ صفَّ الأخرى ولو حمل المعرّفَ نفسَه", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await seedNotificationsSession(driver, OTHER)
    await notificationsSession(driver, OTHER, (store) =>
      intake(store, notifyCtx("u-amir"), personEvent("u-square", { refId: "act-حلب" })),
    )
    await notificationsSession(driver, MAIN, (store) =>
      intake(store, notifyCtx("u-amir"), personEvent("u-square", { refId: "act-حمص" })),
    )
    const rows = (await rowsOf(driver, "notification_queue")) as readonly Record<string, unknown>[]
    // معرّفٌ واحدٌ (`ntf-1`) في شبكتين — والمفتاحُ الطبيعيّ يفصلهما بالشبكة لا بالمرجع.
    expect(rows.map((r) => `${String(r["tenant_id"])}|${String(r["id"])}|${String(r["ref_id"])}`).sort()).toEqual([
      "t-aleppo|ntf-1|act-حلب",
      "t-main|ntf-1|act-حمص",
    ])
    driver.close()
  })

  it("عزلُ النطاق: **الإعلانُ منطاقٌ** فجلسةُ مسجدٍ لا تحمّل إعلانَ جاره", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, (store) => {
      const a = publishAnnouncement(store, notifyCtx("u-amir"), {
        unitId: "khalid",
        titleAr: "إعلانُ خالد",
        bodyAr: "نصٌّ",
        audience: "unit",
      })
      const b = publishAnnouncement(store, notifyCtx("u-amir-bilal"), {
        unitId: "bilal",
        titleAr: "إعلانُ بلال",
        bodyAr: "نصٌّ",
        audience: "unit",
      })
      expect(a.ok && b.ok).toBe(true)
    })

    await notificationsSession(
      driver,
      MAIN,
      (store) => {
        expect(store.announcements().map((a) => a.titleAr)).toEqual(["إعلانُ بلال"])
      },
      BILAL_PATH,
    )
    driver.close()
  })

  it("**وصندوقُ الشخص شبكيٌّ**: جلسةٌ بنطاقٍ ضيّقٍ تُحمّل طابورَه كاملاً — لا صندوقٌ يُبتَر صامتاً", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, submitToSquare)

    // مفتاحُ توجيه الطابور جذرُ الشبكة (لا مسارُ وحدة)، ومُرشِّحُ النطاق يضمّ صفوفَ الجذر
    // **في كل جلسة**. فلو سكن الطابورُ مسارَ وحدةٍ لصار «إشعاراتي» في جلسةٍ ضيّقةٍ **ناقصاً
    // بلا رمية** — وهو محوٌ صامتٌ في وجهٍ آخر: المستخدمُ لا يرى ما وصله.
    await notificationsSession(
      driver,
      MAIN,
      (store) => {
        expect(store.notifications().map((n) => n.personId).sort()).toEqual([
          ...SQUARE_LAYER_TARGETS,
        ])
        expect(store.deliveries()).toHaveLength(SQUARE_LAYER_TARGETS.length)
      },
      BILAL_PATH,
    )
    const rows = (await rowsOf(driver, "notification_queue")) as readonly Record<string, unknown>[]
    expect(new Set(rows.map((r) => String(r["unit_path"])))).toEqual(new Set(["/"]))
    driver.close()
  })

  it("والقراءةُ مفلترةٌ عند المصدر (ح-٥) بعد عبور القاعدة — لا إخفاءُ صفٍّ في قائمة", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, (store) => {
      publishAnnouncement(store, notifyCtx("u-amir"), {
        unitId: "khalid",
        titleAr: "إعلانُ خالد",
        bodyAr: "نصٌّ",
        audience: "subtree",
      })
    })
    await notificationsSession(driver, MAIN, (store) => {
      // أميرُ خالد في جمهور إعلان خالد، وأميرُ بلال ليس فيه — والحكمُ بمواضع الإسناد.
      expect(myAnnouncements(store, notifyCtx("u-amir")).map((a) => a.titleAr)).toEqual([
        "إعلانُ خالد",
      ])
      expect(myAnnouncements(store, notifyCtx("u-amir-bilal"))).toEqual([])
    })
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٤ — التدقيق: هذه الوحدةُ لا تكتب سجلاً في طبقة البيانات ═══

describe("CR-027 — الإشعاراتُ لا تملك سجلَّ تدقيقٍ في طبقة البيانات", () => {
  it("جلسةُ إشعاراتٍ كاملةٌ **لا تكتب صفَّ `audit_log` واحداً** — التدقيقُ شأنُ طبقة الخادم", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, (store) => {
      submitToSquare(store)
      drainQueue(store, { bell: () => true })
      publishAnnouncement(store, notifyCtx("u-amir"), {
        unitId: "khalid",
        titleAr: "إعلان",
        bodyAr: "نص",
        audience: "unit",
      })
    })
    expect(await rowsOf(driver, "audit_log")).toEqual([])
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٥ — الذرّية: لا نصفَ أثر ═══════════════════════════════

describe("الذرّية — فشلٌ في منتصف الجلسة لا يترك نصفَ أثر", () => {
  it("رميةٌ بعد الإدراج وقبل القذف ⟵ لا إشعارَ ولا تسليمَ **في القاعدة**", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    const boom = new Error("انفجارٌ مصطنعٌ بعد الإدراج وقبل تمام الجلسة")

    await expect(
      notificationsSession(driver, MAIN, (store) => {
        submitToSquare(store)
        throw boom
      }),
    ).rejects.toThrow(boom)

    // الجلسةُ رمت قبل `flush` ⟵ صفرُ عبارةٍ ⟵ صفرُ أثرٍ دائم.
    expect(await rowsOf(driver, "notification_queue")).toEqual([])
    expect(await rowsOf(driver, "notification_deliveries")).toEqual([])
    driver.close()
  })

  it("**قيدُ تفرّد المفتاح الطبيعيّ (ت-٨) يحرس القاعدة**: طابورٌ لا يُنشئ إشعارَين لحدثٍ واحد", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    const dup = (id: string): SqlStatement => ({
      sql:
        "INSERT INTO notification_queue (tenant_id, unit_path, id, person_id, kind_id, ref_id," +
        " window_key, natural_key, summary_ar, amount_minor, amount_currency, outcome_ar," +
        " reason_ar, status, queued_at, read_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      params: [MAIN, "/", id, "u-square", "action.outcome", "act-1", "w29",
        "u-square|action.outcome|act-1|w29", "خلاصة", null, null, null, null, "queued", NOW.getTime(), null],
    })
    await driver.batch([dup("ntf-1")])
    // صفٌّ ثانٍ بالمفتاح الطبيعيّ نفسِه ⟵ القاعدةُ ترفض (خريطةُ الذاكرة صارت قيدَ تفرّدٍ على D1).
    await expect(driver.batch([dup("ntf-2")])).rejects.toThrow()
    driver.close()
  })

  it("**قيدُ تفرّد خ-٣ يحرس القاعدة**: قناتان بنفس (قناة، معرّفٌ خارجيّ) لا تتعايشان", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    const link = (id: string, person: string): SqlStatement => ({
      sql:
        "INSERT INTO notification_channels (tenant_id, unit_path, id, person_id, channel," +
        " external_id, linked_at) VALUES (?,?,?,?,?,?,?)",
      params: [MAIN, "/", id, person, "telegram", "tg-x", NOW.getTime()],
    })
    await driver.batch([link("chn-1", "u-square")])
    // «لا يُستولى على قناة غيرك بمعرّفٍ منقول» (خ-٣) — بنيةٌ في القاعدة لا انضباطٌ في الذاكرة وحدها.
    await expect(driver.batch([link("chn-2", "u-amir")])).rejects.toThrow()
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٦/٧ — تطابقُ البديلين خطوةً خطوة ═══════════════════════

type Observation = {
  readonly kinds: readonly string[]
  readonly queue: readonly string[]
  readonly deliveries: readonly string[]
  readonly tokens: readonly string[]
  readonly channels: readonly string[]
  readonly announcements: readonly string[]
}

function observe(store: NotificationStore): Observation {
  return {
    kinds: store.kinds().map((k) => `${k.id}|${k.trigger}|${k.active}`).sort(),
    queue: store
      .notifications()
      .map(
        (n) =>
          `${n.id}|${n.personId}|${n.kindId}|${n.refId}|${n.windowKey}|${n.status}|` +
          `${n.payload.summaryAr}|${n.payload.amount?.minor ?? "—"}|${n.payload.amount?.currency ?? "—"}|` +
          `${n.readAt?.toISOString() ?? "—"}`,
      )
      .sort(),
    deliveries: store
      .deliveries()
      .map((d) => `${d.id}|${d.channel}|${d.status}|${d.attempts}|${d.lastErrorAr ?? "—"}`)
      .sort(),
    tokens: store
      .tokens()
      .map((t) => `${t.id}|${t.personId}|${t.channel}|${t.ttlMinutes}|${t.consumedAt?.toISOString() ?? "—"}`)
      .sort(),
    channels: store.channels().map((c) => `${c.id}|${c.personId}|${c.channel}|${c.externalId}`).sort(),
    announcements: store
      .announcements()
      .map((a) => `${a.id}|${a.unitId}|${a.scopePath}|${a.audience}|${a.publisherPersonId}`)
      .sort(),
  }
}

/** خطواتُ السيناريو — متزامنةٌ بحتة، تُشغَّل **حرفياً** على البديلين. */
const STEPS: readonly ((store: NotificationStore) => void)[] = [
  (store) => {
    expect(intake(store, notifyCtx("u-amir"), submissionEvent()).ok).toBe(true)
  },
  (store) => {
    // الجرسُ لكلٍّ من المستهدَفَين ⟵ تسليمان يُسلَّمان.
    const r = drainQueue(store, { bell: () => true })
    expect(r.delivered).toBe(SQUARE_LAYER_TARGETS.length)
  },
  (store) => {
    expect(markRead(store, notifyCtx("u-granted"), { notificationId: "ntf-1" }).ok).toBe(true)
  },
  (store) => {
    expect(startTelegramLink(store, notifyCtx("u-square")).ok).toBe(true)
  },
  (store) => {
    // يستهلك `lnk-3` ويُنشئ `chn-4` — الرمزُ يصير مختوماً لا محذوفاً.
    expect(
      linkChannel(store, notifyCtx("u-square"), {
        channel: "telegram",
        externalId: "tg-u-square",
        token: "lnk-3",
      }).ok,
    ).toBe(true)
  },
  (store) => {
    expect(
      publishAnnouncement(store, notifyCtx("u-amir"), {
        unitId: "khalid",
        titleAr: "تذكيرٌ لمسجد خالد",
        bodyAr: "نصُّ الإعلان",
        audience: "subtree",
      }).ok,
    ).toBe(true)
  },
  (store) => {
    // نتيجةٌ بمبلغ لصاحب الفعل — وقد ربط تيليغرام، فتنشأ سطرا تسليمٍ (جرسٌ + تيليغرام).
    expect(
      intake(store, notifyCtx("u-amir"), personEvent("u-square", {
        refId: "act-9",
        windowKey: "w30",
        payload: payload({ summaryAr: "نتيجةٌ بمبلغ", amount: { minor: 5000, currency: "USD" } }),
      })).ok,
    ).toBe(true)
  },
  (store) => {
    // تصريفٌ: الجرسُ ينجح وتيليغرام يفشل ⟵ سطرٌ `delivered` وآخرُ `failed` بسببه.
    const r = drainQueue(store, { bell: () => true, telegram: () => false })
    expect(`${r.delivered}|${r.failed}`).toBe("1|1")
  },
]

describe("تطابقُ البديلين — الإشعاراتُ في الذاكرة وعلى D1", () => {
  it("السيناريو نفسُه يعطي النتائج نفسَها على البديلين **خطوةً خطوة**", async () => {
    const memory = freshNotificationStore(MAIN)
    seedNotificationRefs(memory)
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)

    for (const [index, step] of STEPS.entries()) {
      step(memory)
      const inMemory = observe(memory)
      const onD1 = await notificationsSession(driver, MAIN, (store) => {
        step(store)
        return observe(store)
      })
      expect(`الخطوة ${index + 1}: ${JSON.stringify(onD1)}`).toBe(
        `الخطوة ${index + 1}: ${JSON.stringify(inMemory)}`,
      )
    }
    driver.close()
  })

  it("الحالةُ الدائمة تُقرأ بعد الجلسة كما تُركت — التحميلُ والإسقاطُ متعاكسان", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    for (const step of STEPS) await notificationsSession(driver, MAIN, step)
    const first = await notificationsSession(driver, MAIN, observe)
    const second = await notificationsSession(driver, MAIN, observe)
    expect(second).toEqual(first)
    driver.close()
  })

  it("قراءةٌ بلا كتابة **لا تُنتج عبارةً واحدة** — فالتحميلُ لا يُلوّث طابوراً ملحقاً فقط", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, submitToSquare)
    const before = await rowsOf(driver, "notification_queue")
    const statements = await statementsAfter(driver, MAIN, (store) => {
      void myNotifications(store, notifyCtx("u-square"))
    })
    expect(statements).toEqual([])
    expect(await rowsOf(driver, "notification_queue")).toEqual(before)
    driver.close()
  })
})

// ═══ الاختبار الإلزاميّ ٨ — الحتميّة والعدّاد عبر الجلسات ═══════════════════════

describe("الحتميّة تنجو عبور القاعدة — العدّادُ يُستأنف ولا يعود صفراً", () => {
  it("المعرّفُ متتابعٌ عبر ثلاث جلسات — فلا يُدهس إشعارٌ بإشعار", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    const ids: string[] = []
    for (const ref of ["r1", "r2", "r3"]) {
      const id = await notificationsSession(driver, MAIN, (store) => {
        const done = intake(store, notifyCtx("u-amir"), personEvent("u-square", { refId: ref, windowKey: ref }))
        if (!done.ok) throw new Error(done.error.code)
        return done.value.notificationIds[0]!
      })
      ids.push(id)
    }
    expect(ids).toEqual(["ntf-1", "ntf-2", "ntf-3"])
    expect(await rowsOf(driver, "notification_queue")).toHaveLength(3)
    driver.close()
  })

  it("**والنطاقُ الجزئيُّ لا يُنقص العدّاد**: إعلانٌ خارج نطاقِ الجلسة لا يُقرأ، والعدّادُ يُستأنف بالمحفوظ", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    // إعلانٌ عند خالد يرفع العدّاد إلى `ann-1` — ومساره خارجَ نطاق بلال.
    await notificationsSession(driver, MAIN, (store) => {
      const done = publishAnnouncement(store, notifyCtx("u-amir"), {
        unitId: "khalid",
        titleAr: "إعلان",
        bodyAr: "نص",
        audience: "unit",
      })
      if (!done.ok) throw new Error(done.error.code)
    })
    // جلسةٌ ترى بلال فقط: إعلانُ خالد غيرُ محمَّل، ومع ذلك يُستأنف العدّادُ من المحفوظ (`sequences`).
    const next = await notificationsSession(
      driver,
      MAIN,
      (store) => {
        expect(store.announcements()).toEqual([])
        const link = startTelegramLink(store, notifyCtx("u-square"))
        if (!link.ok) throw new Error(link.error.code)
        return link.value.token
      },
      BILAL_PATH,
    )
    // العدّادُ استُؤنف من ١ (إعلانُ خالد) ⟵ الرمزُ `lnk-2` لا `lnk-1`: لا دهسَ لمعرّفٍ محفوظ.
    expect(next).toBe("lnk-2")
    driver.close()
  })

  it("ولا ساعةَ في المستودع: قاعدتان مستقلتان تُنتجان الصفوفَ نفسَها حرفياً", async () => {
    const runs: string[] = []
    for (let i = 0; i < 2; i += 1) {
      const driver = await freshDb()
      await seedNotificationsSession(driver, MAIN)
      await notificationsSession(driver, MAIN, (store) => {
        submitToSquare(store)
        drainQueue(store, { bell: () => true })
      })
      runs.push(JSON.stringify(await rowsOf(driver, "notification_queue")))
      driver.close()
    }
    expect(runs[1]).toBe(runs[0])
  })
})

// ═══ الاختبار الإلزاميّ ٩ — ميزانيةُ التحميل (G23) ════════════════════════════

describe("ميزانيةُ التحميل — الإشعاراتُ تُعلن سقفَها وتُقاس عليه (G23)", () => {
  it("سقفُ الإشعارات موجبٌ ومُعلَنٌ في المصنع — لا مستودعَ بلا سقف", () => {
    const source = persistentNotifications(new NotificationStore(MAIN))
    expect(`${source.name}:${source.rowBudget > 0}`).toBe("notifications:true")
  })

  it("**وتجاوزُه رميةٌ تُسمّي الوحدةَ والجدولَ الأكبر** — لا «تجاوزٌ» مبهمة", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, submitToSquare)
    const store = freshNotificationStore(MAIN)
    const uow = new UnitOfWork(driver, { tenantId: MAIN, scopePath: "/" })
    uow.enlist({ ...persistentNotifications(store), rowBudget: 2 })
    await expect(uow.hydrate()).rejects.toThrow(/وحدةُ عمل «notifications»/)
    await expect(uow.hydrate()).rejects.toThrow(/notification_/)
    driver.close()
  })
})

// ═══ حوافُّ الطبقة — دفاعاتٌ تُختبر لا تُفترض ══════════════════════════════════

describe("حوافُّ مستودع الإشعارات — والسلبُ أكثرُ من الإيجاب", () => {
  it("تحميلٌ من لا شيء لا يرمي ولا يخترع — قاعدةٌ فارغةٌ مستودعٌ فارغٌ وعدّادٌ من الصفر", () => {
    const store = new NotificationStore(MAIN)
    persistentNotifications(store).load(new Map())
    expect(store.notifications()).toEqual([])
    expect(store.channels()).toEqual([])
    expect(store.announcements()).toEqual([])
    expect(store.nextId("ntf")).toBe("ntf-1")
  })

  it("الحمولةُ ذاتُ المبلغِ تعبر القاعدةَ سنتاً وعملة، والفارغةُ تبقى فارغةً بلا اختراع", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, (store) => {
      intake(store, notifyCtx("u-amir"), personEvent("u-square", {
        refId: "with-amount",
        windowKey: "wA",
        payload: payload({ summaryAr: "بمبلغ", amount: { minor: 7500, currency: "SYP" } }),
      }))
      intake(store, notifyCtx("u-amir"), personEvent("u-square", {
        refId: "no-amount",
        windowKey: "wB",
      }))
    })
    const rows = (await rowsOf(driver, "notification_queue")) as readonly Record<string, unknown>[]
    const byRef = new Map(rows.map((r) => [String(r["ref_id"]), r]))
    expect(`${byRef.get("with-amount")!["amount_minor"]}|${byRef.get("with-amount")!["amount_currency"]}`).toBe(
      "7500|SYP",
    )
    expect(byRef.get("no-amount")!["amount_minor"]).toBeNull()
    expect(byRef.get("no-amount")!["amount_currency"]).toBeNull()

    // وبعد التحميل: المبلغُ يُعاد بناؤه كائناً، والفارغُ `null` — لا صفرٌ مخترع.
    await notificationsSession(driver, MAIN, (store) => {
      const withAmount = store.notifications().find((n) => n.refId === "with-amount")!
      const noAmount = store.notifications().find((n) => n.refId === "no-amount")!
      expect(withAmount.payload.amount).toEqual({ minor: 7500, currency: "SYP" })
      expect(noAmount.payload.amount).toBeNull()
    })
    driver.close()
  })

  it("الرمزُ المستهلَكُ يعبر القاعدةَ مختوماً بزمنه — لا يُعاد إصدارُه", async () => {
    const driver = await freshDb()
    await seedNotificationsSession(driver, MAIN)
    await notificationsSession(driver, MAIN, (store) => {
      expect(seedLinkedTelegram(store, "u-square")).toBe(true)
    })
    const tokens = (await rowsOf(driver, "notification_link_tokens")) as readonly Record<string, unknown>[]
    expect(tokens).toHaveLength(1)
    expect(tokens[0]!["consumed_at"]).toBe(NOW.getTime())
    // وبعد التحميل يُقرأ مختوماً — فربطٌ ثانٍ بالرمز نفسِه يُردّ `LINK_TOKEN_CONSUMED`.
    await notificationsSession(driver, MAIN, (store) => {
      const again = linkChannel(store, notifyCtx("u-square"), {
        channel: "telegram",
        externalId: "tg-again",
        token: String(tokens[0]!["id"]),
      })
      expect(again.ok ? "ok" : again.error.code).toBe("LINK_TOKEN_CONSUMED")
    })
    driver.close()
  })
})

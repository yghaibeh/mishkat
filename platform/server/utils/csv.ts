// مُحلّل CSV بسيط لاستيراد المساجد (تصدير Excel → CSV): name,gender,district

export interface MosqueRow {
  name: string
  genderTrack: 'male' | 'female'
  district?: string
}

export function parseMosqueCsv(text: string): { rows: MosqueRow[]; errors: string[] } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows: MosqueRow[] = []
  const errors: string[] = []
  if (!lines.length) return { rows, errors: ['ملف فارغ'] }

  // تجاهل سطر الترويسة إن وُجد
  let start = 0
  const first = lines[0].toLowerCase()
  if (first.includes('name') || lines[0].includes('اسم')) start = 1

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim())
    const name = cols[0]
    if (!name) { errors.push(`السطر ${i + 1}: اسم فارغ`); continue }
    const g = (cols[1] || 'male').toLowerCase()
    const genderTrack: 'male' | 'female' = (g === 'female' || g === 'نساء' || g === 'f') ? 'female' : 'male'
    rows.push({ name, genderTrack, district: cols[2] || undefined })
  }
  return { rows, errors }
}

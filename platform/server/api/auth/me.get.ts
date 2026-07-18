import { requireUser } from '../../utils/context'

// بيانات المستخدم الحالي وأدواره النشطة
export default defineEventHandler(async (event) => {
  return await requireUser(event)
})

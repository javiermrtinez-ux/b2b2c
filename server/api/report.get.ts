import { getDb } from '../utils/db'
import { parseFilters } from '../utils/filters'
import { filterableKeys } from '../utils/glossary'
import { buildReport, parsePeriod } from '../utils/report'

export default defineEventHandler((event) => {
  const q = getQuery(event)
  const db = getDb()
  return buildReport(db, parsePeriod(q.period), new Date(), parseFilters(q, filterableKeys(db)))
})

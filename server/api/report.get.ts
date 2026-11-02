import { getDb } from '../utils/db'
import { buildReport, parsePeriod } from '../utils/report'

/** Tablero: /api/report?period=3m|6m|12m (12m por defecto). */
export default defineEventHandler((event) => buildReport(getDb(), parsePeriod(getQuery(event).period)))

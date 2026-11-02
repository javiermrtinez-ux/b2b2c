import { getDb } from '../utils/db'
import { getGlossary } from '../utils/glossary'

/** Opciones de los filtros del informe: programas, afiliados y valores de los campos extra filtrables. */
export default defineEventHandler(() => {
  const db = getDb()
  const programs = db
    .prepare(
      `SELECT program_id AS id, COALESCE(MAX(program_name), 'Programa ' || program_id) AS label, COUNT(*) AS count
       FROM sales WHERE program_id IS NOT NULL GROUP BY program_id ORDER BY label`
    )
    .all()
  const affiliates = db
    .prepare(
      `SELECT s.affiliate_id AS id, COALESCE(a.name, 'Afiliado ' || s.affiliate_id) AS label, COUNT(*) AS count
       FROM sales s LEFT JOIN affiliates a ON a.id = s.affiliate_id GROUP BY s.affiliate_id ORDER BY label`
    )
    .all()
  const extras = getGlossary(db)
    .filter((g) => g.filterable)
    .map((g) => ({
      key: g.key,
      label: g.label,
      group: g.group,
      // La clave sale del glosario (identificador fijo), no de la petición.
      values: db
        .prepare(
          `SELECT CAST(json_extract(extra, '$.${g.key}') AS TEXT) AS value, COUNT(*) AS count FROM sales
           WHERE json_extract(extra, '$.${g.key}') IS NOT NULL GROUP BY value ORDER BY count DESC, value LIMIT 50`
        )
        .all()
    }))
    .filter((e) => e.values.length)
  const range = db.prepare('SELECT MIN(substr(occurred_at, 1, 10)) AS min, MAX(substr(occurred_at, 1, 10)) AS max FROM sales').get()
  return { programs, affiliates, extras, range }
})

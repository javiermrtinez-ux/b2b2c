import { getDb } from '../../utils/db'
import { GROUPS, getGlossary } from '../../utils/glossary'

/** Glosario: todos los campos que puede traer Tradedoubler, con lo que se guarda, se muestra y se filtra. */
export default defineEventHandler(() => ({ groups: GROUPS, fields: getGlossary(getDb()) }))

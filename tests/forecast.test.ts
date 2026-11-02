import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forecast, normalCdf } from '../utils/forecast.ts'

test('normalCdf: valores conocidos', () => {
  assert.ok(Math.abs(normalCdf(0) - 0.5) < 1e-6)
  assert.ok(Math.abs(normalCdf(1.96) - 0.975) < 1e-4)
  assert.ok(Math.abs(normalCdf(-1.96) - 0.025) < 1e-4)
})

test('forecast: menos de 3 meses no proyecta', () => {
  assert.equal(forecast([100, 200]), null)
})

test('forecast: serie perfectamente lineal sigue la recta y no tiene banda', () => {
  const f = forecast([100, 110, 120, 130], 4)!
  assert.deepEqual(f.points.map((p) => p.value), [140, 150, 160, 170])
  assert.deepEqual(f.points.map((p) => p.high - p.low), [0, 0, 0, 0])
  assert.equal(f.next3, 450)
  assert.equal(f.beatPrev3Pct, 100) // 450 frente a 360
  assert.equal(f.monthlyTrendPct, 8.7) // 10 sobre una media de 115
})

test('forecast: escenarios ordenados y dentro de la banda; la banda se abre con el tiempo', () => {
  const v = [100, 130, 105, 150, 120, 160, 140]
  const c = forecast(v, 4, 'conservative')!
  const b = forecast(v, 4, 'base')!
  const o = forecast(v, 4, 'optimistic')!
  for (let i = 0; i < 4; i++) {
    assert.ok(c.points[i].value < b.points[i].value && b.points[i].value < o.points[i].value)
    assert.ok(c.points[i].value >= b.points[i].low && o.points[i].value <= b.points[i].high)
  }
  assert.ok(b.points[3].high - b.points[3].low > b.points[0].high - b.points[0].low)
  assert.ok(c.beatPrev3Pct < b.beatPrev3Pct && b.beatPrev3Pct < o.beatPrev3Pct)
})

test('forecast: nunca proyecta importes negativos', () => {
  const f = forecast([300, 200, 100, 50], 4)!
  assert.ok(f.points.every((p) => p.value >= 0 && p.low >= 0))
})

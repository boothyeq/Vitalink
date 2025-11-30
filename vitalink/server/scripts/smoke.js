const base = process.env.BASE_URL || 'http://localhost:3001'
const pid = process.env.PID || 'mock'

async function get(path) {
  const res = await fetch(base + path)
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch (_) { json = text }
  return { status: res.status, body: json }
}

async function post(path, body) {
  const res = await fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch (_) { json = text }
  return { status: res.status, body: json }
}

async function main() {
  const h = await get('/health')
  if (h.status !== 200) { console.error('health', h); process.exit(1) }
  console.log('health ok')

  const g1 = await get('/patient/medications?patientId=' + encodeURIComponent(pid))
  if (g1.status !== 200) { console.error('medications get', g1); process.exit(1) }
  console.log('medications get', g1.body)

  const save = await post('/patient/medications', { patientId: pid, beta_blockers: true, raas_inhibitors: false, mras: true, sglt2_inhibitors: false, statin: true, notify_hour: 9 })
  if (save.status !== 200) { console.error('medications post', save); process.exit(1) }
  console.log('medications post ok')

  const g2 = await get('/patient/medications?patientId=' + encodeURIComponent(pid))
  if (g2.status !== 200) { console.error('medications get2', g2); process.exit(1) }
  const prefs = g2.body && g2.body.preferences
  if (!prefs || prefs.beta_blockers !== true || prefs.mras !== true || prefs.statin !== true) { console.error('medications verify', g2.body); process.exit(1) }
  console.log('medications verify ok')

  const now = new Date()
  const start1 = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const end1 = new Date(now.getTime() - 30 * 60 * 1000).toISOString()
  const start2 = new Date(now.getTime() - 25 * 60 * 1000).toISOString()
  const end2 = new Date(now.getTime() - 5 * 60 * 1000).toISOString()
  const distPayload = [
    { patientId: pid, originId: 'orig', deviceId: 'dev', startTs: start1, endTs: end1, meters: 500, recordUid: pid + '|d1', tzOffsetMin: 0 },
    { patientId: pid, originId: 'orig', deviceId: 'dev', startTs: start2, endTs: end2, meters: 800, recordUid: pid + '|d2', tzOffsetMin: 0 }
  ]
  const dist = await post('/ingest/distance-events', distPayload)
  if (dist.status !== 200) { console.error('distance ingest', dist); process.exit(1) }
  console.log('distance ingest ok')

  const sum = await get('/patient/summary?patientId=' + encodeURIComponent(pid))
  if (sum.status !== 200) { console.error('summary', sum); process.exit(1) }
  console.log('summary', sum.body)
  console.log('done')
}

main().catch((e) => { console.error('error', e); process.exit(1) })


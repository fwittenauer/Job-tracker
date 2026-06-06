import * as XLSX from 'xlsx'

const SHEET_NAME = 'Applies'

function fmtDate(v) {
  if (v === null || v === undefined || v === '') return ''
  if (v instanceof Date) return isNaN(v) ? '' : v.toISOString().slice(0, 10)
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  const d = new Date(s)
  return isNaN(d) ? s : d.toISOString().slice(0, 10)
}

function parseFlags(notes, extra) {
  const c = ((notes || '') + ' ' + (extra || '')).toLowerCase()
  const flags = []
  if (/apply w\/ linkedin on|apply with linkedin on|linkedin easy apply|linkedin turned on/i.test(c) &&
      !/linkedin.*?off/i.test(c)) flags.push('li-on')
  if (/linkedin off|linkedin not|no apply w\/ linkedin|linkedin.*?off/i.test(c)) flags.push('li-off')
  if (/indeed on/i.test(c)) flags.push('indeed-on')
  if (/indeed off|no indeed|indeed not/i.test(c)) flags.push('indeed-off')
  if (/street address/i.test(c)) flags.push('street')
  return flags
}

export function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })

  if (!wb.SheetNames.includes(SHEET_NAME)) {
    throw new Error(`Sheet "${SHEET_NAME}" not found. Please upload Opportunities7.xlsx.`)
  }

  const ws = wb.Sheets[SHEET_NAME]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  // Find header row (contains "Organization")
  let headerRow = 3
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    if (raw[i].some(c => String(c).trim() === 'Organization')) { headerRow = i; break }
  }

  const entries = []
  for (let i = headerRow + 1; i < raw.length; i++) {
    const row = raw[i]
    const org = String(row[0] || '').trim()
    if (!org || org === 'Organization') continue

    const notes = String(row[9] || '').trim()
    const extra = String(row[10] || '').trim()

    entries.push({
      _row: i,
      org,
      role:          String(row[1]  || '').trim(),
      loc:           String(row[2]  || '').trim(),
      applied:       fmtDate(row[3]),
      no:            fmtDate(row[4]),
      screen:        fmtDate(row[5]),
      nextSteps:     String(row[6]  || '').trim(),
      contacts:      String(row[7]  || '').trim(),
      ats:           String(row[8]  || '').trim(),
      notes,
      extraNotes:    extra,
      flags:         parseFlags(notes, extra),
      interviewDate: fmtDate(row[13] || ''),
      offerDate:     fmtDate(row[14] || ''),
      status:        String(row[15]  || '').trim(),
    })
  }

  return { entries, raw, headerRow, wb }
}

export function buildExport(originalRaw, headerRow, entries) {
  const raw = originalRaw.map(r => [...r])

  // Ensure new header columns exist
  if (!raw[headerRow][13] || raw[headerRow][13] === '') raw[headerRow][13] = 'Interview Date'
  if (!raw[headerRow][14] || raw[headerRow][14] === '') raw[headerRow][14] = 'Offer Date'
  if (!raw[headerRow][15] || raw[headerRow][15] === '') raw[headerRow][15] = 'Status'

  // Write-back existing rows
  entries.filter(e => e._row !== undefined).forEach(e => {
    const r = e._row
    while (raw[r].length < 16) raw[r].push('')
    raw[r][3]  = e.applied
    raw[r][4]  = e.no
    raw[r][5]  = e.screen
    raw[r][6]  = e.nextSteps
    raw[r][7]  = e.contacts
    raw[r][8]  = e.ats
    raw[r][9]  = e.notes
    raw[r][13] = e.interviewDate
    raw[r][14] = e.offerDate
    raw[r][15] = e.status
  })

  // Append new entries (no _row)
  entries.filter(e => e._row === undefined).forEach(e => {
    const newRow = new Array(16).fill('')
    newRow[0]  = e.org
    newRow[1]  = e.role
    newRow[2]  = e.loc
    newRow[3]  = e.applied
    newRow[4]  = e.no
    newRow[5]  = e.screen
    newRow[6]  = e.nextSteps
    newRow[7]  = e.contacts
    newRow[8]  = e.ats
    newRow[9]  = e.notes
    newRow[13] = e.interviewDate
    newRow[14] = e.offerDate
    newRow[15] = e.status
    raw.push(newRow)
  })

  const ws  = XLSX.utils.aoa_to_sheet(raw)
  const wb  = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, SHEET_NAME)
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
}

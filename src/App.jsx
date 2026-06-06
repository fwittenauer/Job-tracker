import React, { useState, useMemo, useRef } from 'react'
import { parseWorkbook, buildExport } from './excel'

const STATUS_OPTIONS = [
  '', 'Applied', 'Screening', 'Phone Screen', 'Interviewing',
  'Final Round', 'Offer Received', 'Accepted', 'Declined Offer',
  'Rejected', 'Withdrew', 'No Response',
]
const FLAG_META = {
  'li-on':     { label: 'LinkedIn ON',  cls: 'fl-li-on'   },
  'li-off':    { label: 'LinkedIn OFF', cls: 'fl-li-off'  },
  'indeed-on': { label: 'Indeed ON',    cls: 'fl-indeed'  },
  'indeed-off':{ label: 'Indeed OFF',   cls: 'fl-indeed-off' },
  'street':    { label: 'Street Addr',  cls: 'fl-street'  },
}
const ATS_SUGGESTIONS = [
  'Workday','Greenhouse','LinkedIn Easy Apply','SuccessFactors','iCIMS',
  'Taleo','Brassring','Oracle Recruiting Cloud','Lever','Jobvite',
  'SmartRecruiters','Ashby','Avature','Phenom','Dayforce','UKG',
  'BambooHR','Rippling','Workable','ADP','Eightfold','Paradox','Email',
]
const PER_PAGE = 30
const CHART_COLORS = ['#2a5298','#1a7f5a','#b45309','#7c3aed','#c0392b','#0891b2','#be185d','#065f46']

function dateDiff(a, b) {
  if (!a || !b) return null
  const d = Math.round((new Date(b) - new Date(a)) / 86400000)
  return isNaN(d) ? null : d
}

function emptyEntry() {
  return {
    org:'', role:'', loc:'', ats:'', applied:'', screen:'',
    interviewDate:'', offerDate:'', no:'', status:'',
    contacts:'', nextSteps:'', notes:'', flags:[], _row: undefined,
  }
}

function TextF({ label, id, value, onChange, placeholder, list, required, cls }) {
  return (
    <div className={`field ${cls||''}`}>
      <label htmlFor={id}>{label}{required && <span className="req"> *</span>}</label>
      <input type="text" id={id} value={value} placeholder={placeholder||''}
        list={list ? list+'-dl' : undefined} autoComplete="off"
        onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function DateF({ label, id, value, onChange, cls }) {
  return (
    <div className={`field ${cls||''}`}>
      <label htmlFor={id}>{label}</label>
      <input type="date" id={id} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

// ── Simple SVG bar chart ─────────────────────────────────────
function BarChart({ data, color, unit='', height=180, horizontal=false }) {
  if (!data || !data.length) return <div className="chart-empty">No data</div>
  const max = Math.max(...data.map(d => d.value), 1)

  if (horizontal) {
    const barH = 24, gap = 6, padding = { left: 140, right: 60, top: 10, bottom: 10 }
    const svgH = data.length * (barH + gap) + padding.top + padding.bottom
    const svgW = 500
    const chartW = svgW - padding.left - padding.right
    return (
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{width:'100%',maxWidth:svgW,display:'block'}}>
        {data.map((d, i) => {
          const y = padding.top + i * (barH + gap)
          const w = Math.max(2, (d.value / max) * chartW)
          return (
            <g key={d.label}>
              <text x={padding.left - 6} y={y + barH/2 + 4} textAnchor="end"
                fontSize={11} fill="#5a5650">{d.label}</text>
              <rect x={padding.left} y={y} width={w} height={barH}
                fill={color || CHART_COLORS[0]} rx={3} opacity={0.85}/>
              <text x={padding.left + w + 5} y={y + barH/2 + 4}
                fontSize={11} fill="#1c1a17">{d.value}{unit}</text>
            </g>
          )
        })}
      </svg>
    )
  }

  const padding = { left: 40, right: 10, top: 10, bottom: 28 }
  const svgW = Math.max(300, data.length * 52)
  const chartH = height - padding.top - padding.bottom
  const chartW = svgW - padding.left - padding.right
  const barW = Math.min(40, chartW / data.length - 4)

  return (
    <svg viewBox={`0 0 ${svgW} ${height}`} style={{width:'100%',display:'block'}}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = padding.top + chartH * (1 - t)
        const val = Math.round(max * t)
        return (
          <g key={t}>
            <line x1={padding.left} x2={svgW - padding.right} y1={y} y2={y}
              stroke="#dedad3" strokeWidth={1}/>
            <text x={padding.left - 4} y={y + 4} textAnchor="end"
              fontSize={9} fill="#9a9690">{val}</text>
          </g>
        )
      })}
      {data.map((d, i) => {
        const x = padding.left + (i / data.length) * chartW + (chartW / data.length - barW) / 2
        const barH = Math.max(2, (d.value / max) * chartH)
        const y = padding.top + chartH - barH
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={barW} height={barH}
              fill={Array.isArray(color) ? color[i % color.length] : (color || CHART_COLORS[0])}
              rx={3} opacity={0.85}/>
            <text x={x + barW/2} y={height - padding.bottom + 12}
              textAnchor="middle" fontSize={10} fill="#5a5650">{d.label}</text>
            <text x={x + barW/2} y={y - 3}
              textAnchor="middle" fontSize={9} fill="#1c1a17">{d.value}{unit}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Line chart for trends ────────────────────────────────────
function LineChart({ series, height=200 }) {
  if (!series || !series.length || !series[0].data.length) return <div className="chart-empty">No data</div>
  const allVals = series.flatMap(s => s.data.map(d => d.value)).filter(v => v !== null)
  const allLabels = series[0].data.map(d => d.label)
  const max = Math.max(...allVals, 1)
  const min = 0
  const padding = { left: 44, right: 16, top: 16, bottom: 28 }
  const svgW = Math.max(360, allLabels.length * 60)
  const chartH = height - padding.top - padding.bottom
  const chartW = svgW - padding.left - padding.right

  function getX(i) { return padding.left + (i / (allLabels.length - 1)) * chartW }
  function getY(v) { return padding.top + chartH - ((v - min) / (max - min)) * chartH }

  return (
    <svg viewBox={`0 0 ${svgW} ${height}`} style={{width:'100%',display:'block'}}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = padding.top + chartH * (1 - t)
        const val = Math.round(max * t)
        return (
          <g key={t}>
            <line x1={padding.left} x2={svgW - padding.right} y1={y} y2={y}
              stroke="#dedad3" strokeWidth={1}/>
            <text x={padding.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9a9690">{val}</text>
          </g>
        )
      })}
      {allLabels.map((lbl, i) => (
        <text key={lbl} x={getX(i)} y={height - padding.bottom + 12}
          textAnchor="middle" fontSize={10} fill="#5a5650">{lbl}</text>
      ))}
      {series.map((s, si) => {
        const pts = s.data.filter(d => d.value !== null)
        if (pts.length < 2) return null
        const path = pts.map((d, i) => {
          const xi = allLabels.indexOf(d.label)
          return `${i === 0 ? 'M' : 'L'}${getX(xi)},${getY(d.value)}`
        }).join(' ')
        return (
          <g key={s.label}>
            <path d={path} fill="none" stroke={CHART_COLORS[si]} strokeWidth={2.5}
              strokeLinejoin="round" strokeLinecap="round"/>
            {pts.map(d => {
              const xi = allLabels.indexOf(d.label)
              return (
                <g key={d.label}>
                  <circle cx={getX(xi)} cy={getY(d.value)} r={4}
                    fill={CHART_COLORS[si]} stroke="#fff" strokeWidth={1.5}/>
                  <text x={getX(xi)} y={getY(d.value) - 8}
                    textAnchor="middle" fontSize={9} fill={CHART_COLORS[si]}
                    fontWeight="600">{d.value}</text>
                </g>
              )
            })}
          </g>
        )
      })}
      {series.length > 1 && (
        <g>
          {series.map((s, si) => (
            <g key={s.label} transform={`translate(${padding.left + si * 120}, ${height - 4})`}>
              <rect width={10} height={10} y={-10} fill={CHART_COLORS[si]} rx={2}/>
              <text x={14} y={-2} fontSize={10} fill="#5a5650">{s.label}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

// ── Analytics Panel ──────────────────────────────────────────
function AnalyticsPanel({ entries }) {
  const years = useMemo(() =>
    [...new Set(entries.map(e => e.applied?.slice(0,4)).filter(Boolean))].sort(),
    [entries])

  // Applications by year
  const appsByYear = useMemo(() =>
    years.map(y => ({ label: y, value: entries.filter(e => (e.applied||'').startsWith(y)).length })),
    [entries, years])

  // Avg days to rejection by year (mean + median)
  const rejectionByYear = useMemo(() => {
    return {
      mean: years.map(y => {
        const days = entries
          .filter(e => (e.applied||'').startsWith(y) && e.no)
          .map(e => dateDiff(e.applied, e.no))
          .filter(d => d !== null && d >= 0)
        return { label: y, value: days.length ? Math.round(days.reduce((a,b)=>a+b,0)/days.length) : null }
      }).filter(d => d.value !== null),
      median: years.map(y => {
        const days = entries
          .filter(e => (e.applied||'').startsWith(y) && e.no)
          .map(e => dateDiff(e.applied, e.no))
          .filter(d => d !== null && d >= 0)
          .sort((a,b) => a-b)
        if (!days.length) return { label: y, value: null }
        const mid = Math.floor(days.length / 2)
        return { label: y, value: days.length % 2 ? days[mid] : Math.round((days[mid-1]+days[mid])/2) }
      }).filter(d => d.value !== null),
    }
  }, [entries, years])

  // Avg days apply to screen by year
  const screenByYear = useMemo(() => {
    return {
      mean: years.map(y => {
        const days = entries
          .filter(e => (e.applied||'').startsWith(y) && e.screen)
          .map(e => dateDiff(e.applied, e.screen))
          .filter(d => d !== null && d >= 0)
        return { label: y, value: days.length ? Math.round(days.reduce((a,b)=>a+b,0)/days.length) : null }
      }).filter(d => d.value !== null),
      median: years.map(y => {
        const days = entries
          .filter(e => (e.applied||'').startsWith(y) && e.screen)
          .map(e => dateDiff(e.applied, e.screen))
          .filter(d => d !== null && d >= 0)
          .sort((a,b) => a-b)
        if (!days.length) return { label: y, value: null }
        const mid = Math.floor(days.length / 2)
        return { label: y, value: days.length % 2 ? days[mid] : Math.round((days[mid-1]+days[mid])/2) }
      }).filter(d => d.value !== null),
    }
  }, [entries, years])

  // Top ATS overall
  const atsOverall = useMemo(() => {
    const counts = {}
    entries.forEach(e => { if (e.ats) counts[e.ats] = (counts[e.ats]||0)+1 })
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,12)
      .map(([label, value]) => ({ label, value }))
  }, [entries])

  // Top ATS by year (top 5 ATS, show count per year)
  const atsByYear = useMemo(() => {
    const top5 = atsOverall.slice(0, 5).map(a => a.label)
    return top5.map((ats, i) => ({
      label: ats,
      data: years.map(y => ({
        label: y,
        value: entries.filter(e => (e.applied||'').startsWith(y) && e.ats === ats).length
      }))
    }))
  }, [entries, years, atsOverall])

  // Flag summary
  const flagSummary = useMemo(() => {
    const total = entries.length
    return Object.entries(FLAG_META).map(([f, { label }]) => ({
      label, flag: f,
      count: entries.filter(e => (e.flags||[]).includes(f)).length,
      pct: total ? Math.round(entries.filter(e => (e.flags||[]).includes(f)).length / total * 100) : 0
    }))
  }, [entries])

  // Top locations
  const topLocs = useMemo(() => {
    const counts = {}
    entries.forEach(e => { if (e.loc) counts[e.loc] = (counts[e.loc]||0)+1 })
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([label, value]) => ({ label, value }))
  }, [entries])

  return (
    <div className="analytics">

      {/* Summary stats */}
      <div className="an-section">
        <div className="an-grid-4">
          <div className="an-card">
            <div className="an-num">{entries.length.toLocaleString()}</div>
            <div className="an-lbl">Total applications</div>
          </div>
          <div className="an-card">
            <div className="an-num">{entries.filter(e=>e.no).length.toLocaleString()}</div>
            <div className="an-lbl">Rejections received</div>
          </div>
          <div className="an-card">
            <div className="an-num">{entries.filter(e=>e.screen).length.toLocaleString()}</div>
            <div className="an-lbl">Phone screens</div>
          </div>
          <div className="an-card">
            <div className="an-num">{entries.filter(e=>e.interviewDate).length.toLocaleString()}</div>
            <div className="an-lbl">Interviews</div>
          </div>
        </div>
      </div>

      {/* Applications by year */}
      <div className="an-section">
        <div className="an-title">Applications submitted by year</div>
        <div className="chart-wrap">
          <BarChart data={appsByYear} color={CHART_COLORS[0]} height={200}/>
        </div>
      </div>

      {/* Days to rejection by year */}
      <div className="an-section">
        <div className="an-title">Days from apply to rejection — by year</div>
        <div className="an-subtitle">Are organizations responding faster over time?</div>
        <div className="chart-legend">
          <span style={{color:CHART_COLORS[0]}}>● Mean</span>
          <span style={{color:CHART_COLORS[1]}}>● Median</span>
        </div>
        <div className="chart-wrap">
          <LineChart series={[
            { label: 'Mean days', data: rejectionByYear.mean },
            { label: 'Median days', data: rejectionByYear.median },
          ]} height={220}/>
        </div>
        <div className="an-insight">
          {rejectionByYear.mean.length >= 2 && (() => {
            const first = rejectionByYear.mean[0]
            const last  = rejectionByYear.mean[rejectionByYear.mean.length - 1]
            const faster = first.value > last.value
            return (
              <span>
                Mean days to rejection went from <strong>{first.value}d</strong> in {first.label} to{' '}
                <strong>{last.value}d</strong> in {last.label} —{' '}
                {faster ? `${first.value - last.value} days faster` : `${last.value - first.value} days slower`}.
              </span>
            )
          })()}
        </div>
      </div>

      {/* Days apply to screen by year */}
      <div className="an-section">
        <div className="an-title">Days from apply to phone screen — by year</div>
        <div className="an-subtitle">Is the funnel moving faster?</div>
        <div className="chart-legend">
          <span style={{color:CHART_COLORS[0]}}>● Mean</span>
          <span style={{color:CHART_COLORS[1]}}>● Median</span>
        </div>
        <div className="chart-wrap">
          <LineChart series={[
            { label: 'Mean days', data: screenByYear.mean },
            { label: 'Median days', data: screenByYear.median },
          ]} height={220}/>
        </div>
      </div>

      {/* ATS by year */}
      <div className="an-section">
        <div className="an-title">Top 5 ATS platforms — usage by year</div>
        <div className="an-subtitle">Has the ATS landscape shifted over time?</div>
        <div className="chart-legend">
          {atsByYear.map((s, i) => (
            <span key={s.label} style={{color: CHART_COLORS[i]}}>● {s.label}</span>
          ))}
        </div>
        <div className="ats-year-grid">
          {years.map(y => {
            const yearData = atsByYear.map(s => ({
              label: s.label.replace(' Easy Apply','').replace(' Recruiting Cloud',''),
              value: s.data.find(d => d.label === y)?.value || 0
            })).filter(d => d.value > 0).sort((a,b) => b.value - a.value)
            return (
              <div key={y} className="ats-year-col">
                <div className="ats-year-label">{y}</div>
                {yearData.map((d, i) => (
                  <div key={d.label} className="ats-year-row">
                    <div className="ats-year-bar-wrap">
                      <div className="ats-year-bar" style={{
                        width: `${Math.round((d.value / Math.max(...yearData.map(x=>x.value))) * 100)}%`,
                        background: CHART_COLORS[atsByYear.findIndex(s => s.label.startsWith(d.label.split(' ')[0])) % CHART_COLORS.length]
                      }}/>
                    </div>
                    <span className="ats-year-name">{d.label}</span>
                    <span className="ats-year-count">{d.value}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Top ATS overall */}
      <div className="an-section">
        <div className="an-title">Top ATS platforms overall</div>
        <div className="chart-wrap">
          <BarChart data={atsOverall} color={CHART_COLORS[2]} horizontal={true}/>
        </div>
      </div>

      {/* Flags */}
      <div className="an-section">
        <div className="an-title">Application flags</div>
        <div className="an-grid-3">
          {flagSummary.map(f => (
            <div key={f.flag} className="an-card">
              <div className="an-num">{f.count.toLocaleString()}</div>
              <div className="an-lbl">{f.label}</div>
              <div className="an-pct">{f.pct}% of applications</div>
            </div>
          ))}
        </div>
      </div>

      {/* Top locations */}
      <div className="an-section">
        <div className="an-title">Top locations</div>
        <div className="chart-wrap">
          <BarChart data={topLocs} color={CHART_COLORS[1]} horizontal={true}/>
        </div>
      </div>

    </div>
  )
}

// ── Entry Form ────────────────────────────────────────────────
function EntryForm({ entry, onChange, onSave, onCancel, saving, orgSuggestions, atsSuggestions }) {
  const set = (k,v) => onChange({...entry,[k]:v})
  const toggleFlag = f => {
    const flags = entry.flags.includes(f) ? entry.flags.filter(x=>x!==f) : [...entry.flags, f]
    set('flags', flags)
  }
  const daysToNo        = dateDiff(entry.applied, entry.no)
  const daysToInterview = dateDiff(entry.applied, entry.interviewDate)
  const daysToOffer     = dateDiff(entry.applied, entry.offerDate)

  return (
    <div className="entry-form">
      <datalist id="org-dl">{orgSuggestions.map(o=><option key={o} value={o}/>)}</datalist>
      <datalist id="ats-dl">{atsSuggestions.map(a=><option key={a} value={a}/>)}</datalist>

      <div className="form-section">
        <div className="form-section-label">Organization & Role</div>
        <div className="form-row cols-2">
          <TextF label="Organization" id="org" value={entry.org} onChange={v=>set('org',v)}
            placeholder="e.g. Acme Corp" list="org" required />
          <TextF label="Role" id="role" value={entry.role} onChange={v=>set('role',v)}
            placeholder="e.g. Director, HR Technology" required />
        </div>
        <div className="form-row cols-3">
          <TextF label="Location" id="loc" value={entry.loc} onChange={v=>set('loc',v)} placeholder="Remote, NYC..." />
          <TextF label="ATS Platform" id="ats" value={entry.ats} onChange={v=>set('ats',v)}
            placeholder="Workday, Greenhouse..." list="ats" />
          <div className="field">
            <label htmlFor="status">Status</label>
            <select id="status" value={entry.status} onChange={e=>set('status',e.target.value)}>
              {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s||'— select —'}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-label">Dates</div>
        <div className="form-row cols-4">
          <DateF label="Date Applied *" id="applied" value={entry.applied} onChange={v=>set('applied',v)} />
          <DateF label="Screen Date"    id="screen"  value={entry.screen}  onChange={v=>set('screen',v)} />
          <DateF label="Interview Date" id="interviewDate" value={entry.interviewDate} onChange={v=>set('interviewDate',v)} />
          <DateF label="Offer Date"     id="offerDate"     value={entry.offerDate}     onChange={v=>set('offerDate',v)} />
        </div>
        <div className="form-row cols-4">
          <DateF label='Date "No" Received' id="no" value={entry.no} onChange={v=>set('no',v)} />
          <div className="field"/>
          <div className="field"/>
          <div className="days-counters">
            {daysToNo        !== null && daysToNo >= 0        && <div className="dc-item"><span className="dc-num">{daysToNo}d</span><span className="dc-lbl">to "no"</span></div>}
            {daysToInterview !== null && daysToInterview >= 0 && <div className="dc-item"><span className="dc-num">{daysToInterview}d</span><span className="dc-lbl">to interview</span></div>}
            {daysToOffer     !== null && daysToOffer >= 0     && <div className="dc-item"><span className="dc-num">{daysToOffer}d</span><span className="dc-lbl">to offer</span></div>}
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-label">Application Flags</div>
        <div className="flags-row">
          {Object.entries(FLAG_META).map(([f,{label,cls}])=>(
            <label key={f} className={`flag-toggle ${cls} ${entry.flags.includes(f)?'active':''}`}>
              <input type="checkbox" checked={entry.flags.includes(f)} onChange={()=>toggleFlag(f)} />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-label">Additional Details</div>
        <div className="form-row cols-2">
          <TextF label="Contacts" id="contacts" value={entry.contacts} onChange={v=>set('contacts',v)} placeholder="Recruiter name..." />
          <TextF label="Next Steps" id="nextSteps" value={entry.nextSteps} onChange={v=>set('nextSteps',v)} placeholder="Interview scheduled..." />
        </div>
        <div className="field">
          <label htmlFor="notes">Notes / URL</label>
          <textarea id="notes" rows={3} value={entry.notes}
            placeholder="ATS job link, notes..."
            onChange={e=>set('notes',e.target.value)} />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn-primary" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : (entry._row!==undefined ? 'Save Changes' : 'Add Entry')}
        </button>
        {onCancel && <button className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  )
}

// ── Upload Screen ─────────────────────────────────────────────
function UploadScreen({ onLoad }) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

  function handleFile(file) {
    if (!file) return
    setError('')
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const result = parseWorkbook(new Uint8Array(e.target.result))
        onLoad(result, file.name)
      } catch(err) { setError(err.message) }
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="upload-screen">
      <div className="upload-card">
        <div className="upload-icon">📋</div>
        <h1 className="upload-title">Job Tracker</h1>
        <p className="upload-sub">Upload your Excel spreadsheet to get started.<br/>All edits stay in memory and export back to Excel when done.</p>
        <div className={`drop-zone ${dragging?'dragging':''}`}
          onDragOver={e=>{e.preventDefault();setDragging(true)}}
          onDragLeave={()=>setDragging(false)}
          onDrop={e=>{e.preventDefault();setDragging(false);handleFile(e.dataTransfer.files[0])}}
          onClick={()=>inputRef.current.click()}>
          <div className="drop-icon">⬆</div>
          <div className="drop-text">Drop <strong>Opportunities7.xlsx</strong> here<br/><span>or click to browse</span></div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{display:'none'}}
            onChange={e=>handleFile(e.target.files[0])} />
        </div>
        {error && <div className="upload-error">{error}</div>}
        <p className="upload-note">Your file never leaves your computer — all processing happens in your browser.</p>
      </div>
    </div>
  )
}

// ── Stat Bar ──────────────────────────────────────────────────
function StatBar({ entries }) {
  const s = useMemo(() => {
    const days = entries.filter(e=>e.no&&e.applied)
      .map(e=>dateDiff(e.applied,e.no)).filter(d=>d!==null&&d>=0)
    return {
      total:       entries.length,
      pending:     entries.filter(e=>!e.no&&!e.offerDate).length,
      declined:    entries.filter(e=>e.no).length,
      avg:         days.length ? Math.round(days.reduce((a,b)=>a+b,0)/days.length) : null,
      screened:    entries.filter(e=>e.screen).length,
      interviewed: entries.filter(e=>e.interviewDate).length,
      offers:      entries.filter(e=>e.offerDate).length,
    }
  }, [entries])
  const items = [
    {label:'Total',            val:s.total.toLocaleString()},
    {label:'Pending',          val:s.pending.toLocaleString()},
    {label:'Declined',         val:s.declined.toLocaleString()},
    {label:'Avg days to "no"', val:s.avg!==null?s.avg+'d':'—'},
    {label:'Screened',         val:s.screened.toLocaleString()},
    {label:'Interviewed',      val:s.interviewed.toLocaleString()},
    {label:'Offers',           val:s.offers.toLocaleString()},
  ]
  return (
    <div className="stat-bar">
      {items.map(i=>(
        <div className="stat" key={i.label}>
          <div className="stat-val">{i.val}</div>
          <div className="stat-lbl">{i.label}</div>
        </div>
      ))}
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [loaded,    setLoaded]    = useState(null)
  const [entries,   setEntries]   = useState([])
  const [tab,       setTab]       = useState('log')
  const [newEntry,  setNewEntry]  = useState(emptyEntry())
  const [editEntry, setEditEntry] = useState(null)
  const [saveMsg,   setSaveMsg]   = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [search,       setSearch]       = useState('')
  const [filterYear,   setFilterYear]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFlag,   setFilterFlag]   = useState('')
  const [filterAts,    setFilterAts]    = useState('')
  const [sortCol,      setSortCol]      = useState('applied')
  const [sortDir,      setSortDir]      = useState(-1)
  const [page,         setPage]         = useState(0)

  function onLoad({entries:e,raw,headerRow,wb}, filename) {
    setLoaded({raw,headerRow,wb,filename})
    setEntries(e)
    setTab('log')
  }

  const orgSuggestions = useMemo(()=>[...new Set(entries.map(e=>e.org).filter(Boolean))].sort(),[entries])
  const atsSuggestions = useMemo(()=>{
    const counts={}
    entries.forEach(e=>{if(e.ats)counts[e.ats]=(counts[e.ats]||0)+1})
    const fromData=Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([k])=>k)
    return [...new Set([...fromData,...ATS_SUGGESTIONS])]
  },[entries])
  const years = useMemo(()=>[...new Set(entries.map(e=>e.applied?.slice(0,4)).filter(Boolean))].sort().reverse(),[entries])
  const atsOptions = useMemo(()=>{
    const counts={}
    entries.forEach(e=>{if(e.ats)counts[e.ats]=(counts[e.ats]||0)+1})
    return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([k])=>k)
  },[entries])

  const filtered = useMemo(()=>{
    let res = entries.filter(e=>{
      const q=search.toLowerCase()
      if(q&&!e.org.toLowerCase().includes(q)&&!(e.role||'').toLowerCase().includes(q)) return false
      if(filterYear&&!(e.applied||'').startsWith(filterYear)) return false
      if(filterStatus==='no'&&!e.no) return false
      if(filterStatus==='pending'&&e.no) return false
      if(filterStatus==='screen'&&!e.screen) return false
      if(filterStatus==='interviewed'&&!e.interviewDate) return false
      if(filterStatus==='offer'&&!e.offerDate) return false
      if(filterFlag&&!(e.flags||[]).includes(filterFlag)) return false
      if(filterAts&&e.ats!==filterAts) return false
      return true
    })
    res.sort((a,b)=>{
      let av=a[sortCol]||'',bv=b[sortCol]||''
      if(sortCol==='days'){av=dateDiff(a.applied,a.no)??99999;bv=dateDiff(b.applied,b.no)??99999}
      return av<bv?-sortDir:av>bv?sortDir:0
    })
    return res
  },[entries,search,filterYear,filterStatus,filterFlag,filterAts,sortCol,sortDir])

  const paginated  = filtered.slice(page*PER_PAGE,(page+1)*PER_PAGE)
  const totalPages = Math.max(1,Math.ceil(filtered.length/PER_PAGE))

  function doSort(col){
    if(sortCol===col) setSortDir(d=>d*-1)
    else{setSortCol(col);setSortDir(-1)}
    setPage(0)
  }

  function flash(text,err=false){setSaveMsg({text,err});setTimeout(()=>setSaveMsg(null),4500)}

  function handleAddEntry(){
    if(!newEntry.org||!newEntry.role||!newEntry.applied){flash('Organization, role, and applied date are required.',true);return}
    setEntries(prev=>[{...newEntry},...prev])
    setNewEntry(emptyEntry())
    setTab('log')
    flash('Entry added — click "Export to Excel" when you are done to save your file.')
  }

  function handleSaveEdit(){
    setEntries(prev=>prev.map(e=>e._row!==undefined&&e._row===editEntry._row?{...editEntry}:e))
    setEditEntry(null)
    flash('Entry updated — click "Export to Excel" to save.')
  }

  function handleDeleteEntry(){
    if(!confirm('Delete this entry?')) return
    setEntries(prev=>prev.filter(e=>!(e._row!==undefined&&e._row===editEntry._row)))
    setEditEntry(null)
    flash('Entry deleted.')
  }

  function handleExport(){
    if(!loaded) return
    setSaving(true)
    try{
      const blob=buildExport(loaded.raw,loaded.headerRow,entries)
      const url=URL.createObjectURL(blob)
      const a=document.createElement('a')
      a.href=url;a.download=loaded.filename||'Opportunities7.xlsx';a.click()
      URL.revokeObjectURL(url)
      flash('Downloaded! Save this file back to your OneDrive folder.')
    } catch(e){flash('Export failed: '+e.message,true)}
    setSaving(false)
  }

  function handleExportCSV(){
    const hdr='Organization,Role,Location,Applied,Screen,Interview,Offer,Response,ATS,Status,Contacts,Flags,Notes'
    const rows=filtered.map(e=>[e.org,e.role,e.loc,e.applied,e.screen,e.interviewDate,e.offerDate,e.no,e.ats,e.status,e.contacts,(e.flags||[]).join('|'),e.notes].map(v=>`"${(v||'').replace(/"/g,'""')}"`).join(','))
    const blob=new Blob([hdr+'\n'+rows.join('\n')],{type:'text/csv'})
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='applies_export.csv';a.click()
  }

  function handleNewFile(){
    if(!confirm('Load a new file? Unsaved changes will be lost.')) return
    setLoaded(null);setEntries([]);setTab('log')
  }

  if(!loaded) return <UploadScreen onLoad={onLoad}/>

  const SortTh=({col,children})=>(
    <th onClick={()=>doSort(col)} className="sortable">
      {children}{sortCol===col?(sortDir===1?' ↑':' ↓'):''}
    </th>
  )

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-logo">📋</span>
          <div>
            <div className="header-title">Job Tracker</div>
            <div className="header-file">{loaded.filename}</div>
          </div>
        </div>
        <div className="header-right">
          {saveMsg && <span className={`save-msg ${saveMsg.err?'err':'ok'}`}>{saveMsg.text}</span>}
          <button className="btn-export" onClick={handleExport} disabled={saving}>⬇ Export to Excel</button>
          <button className="btn-ghost small" onClick={handleExportCSV}>CSV</button>
          <button className="btn-ghost small" onClick={handleNewFile}>Load new file</button>
        </div>
      </header>

      <StatBar entries={entries}/>

      <div className="tabs-bar">
        <div className="tabs">
          <button className={`tab ${tab==='log'?'active':''}`} onClick={()=>setTab('log')}>Application Log</button>
          <button className={`tab ${tab==='new'?'active':''}`} onClick={()=>setTab('new')}>+ New Entry</button>
          <button className={`tab ${tab==='analytics'?'active':''}`} onClick={()=>setTab('analytics')}>Analytics</button>
        </div>
      </div>

      {tab==='new' && (
        <div className="panel">
          <h2 className="panel-title">New Application</h2>
          <EntryForm entry={newEntry} onChange={setNewEntry} onSave={handleAddEntry}
            saving={saving} orgSuggestions={orgSuggestions} atsSuggestions={atsSuggestions}/>
        </div>
      )}

      {tab==='analytics' && (
        <div className="panel">
          <h2 className="panel-title">Analytics</h2>
          <AnalyticsPanel entries={entries}/>
        </div>
      )}

      {tab==='log' && (
        <div className="panel">
          <div className="filter-bar">
            <input className="search-input" type="text" placeholder="Search org or role..."
              value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}}/>
            <select value={filterYear} onChange={e=>{setFilterYear(e.target.value);setPage(0)}}>
              <option value="">All years</option>
              {years.map(y=><option key={y}>{y}</option>)}
            </select>
            <select value={filterStatus} onChange={e=>{setFilterStatus(e.target.value);setPage(0)}}>
              <option value="">All statuses</option>
              <option value="no">Got "no"</option>
              <option value="pending">No response</option>
              <option value="screen">Screened</option>
              <option value="interviewed">Interviewed</option>
              <option value="offer">Offer received</option>
            </select>
            <select value={filterFlag} onChange={e=>{setFilterFlag(e.target.value);setPage(0)}}>
              <option value="">All flags</option>
              {Object.entries(FLAG_META).map(([k,{label}])=><option key={k} value={k}>{label}</option>)}
            </select>
            <select value={filterAts} onChange={e=>{setFilterAts(e.target.value);setPage(0)}}>
              <option value="">All ATS</option>
              {atsOptions.map(a=><option key={a}>{a}</option>)}
            </select>
            {(search||filterYear||filterStatus||filterFlag||filterAts)&&
              <button className="btn-ghost small" onClick={()=>{setSearch('');setFilterYear('');setFilterStatus('');setFilterFlag('');setFilterAts('');setPage(0)}}>✕ Clear</button>}
            <span className="filter-count">{filtered.length.toLocaleString()} results</span>
          </div>

          <div className="table-wrap">
            <table>
              <thead><tr>
                <SortTh col="org">Organization</SortTh>
                <SortTh col="role">Role</SortTh>
                <SortTh col="loc">Location</SortTh>
                <SortTh col="applied">Applied</SortTh>
                <SortTh col="screen">Screen</SortTh>
                <SortTh col="interviewDate">Interview</SortTh>
                <SortTh col="offerDate">Offer</SortTh>
                <SortTh col="no">Response</SortTh>
                <SortTh col="days">Days</SortTh>
                <SortTh col="ats">ATS</SortTh>
                <SortTh col="status">Status</SortTh>
                <th>Flags</th><th></th>
              </tr></thead>
              <tbody>
                {paginated.length===0 && <tr><td colSpan={13} className="empty-row">No results match your filters.</td></tr>}
                {paginated.map((e,i)=>{
                  const days=dateDiff(e.applied,e.no)
                  return (
                    <tr key={i}>
                      <td className="td-org" title={e.org}>{e.org}</td>
                      <td className="td-role" title={e.role}>{e.role||'—'}</td>
                      <td className="td-sm">{e.loc||'—'}</td>
                      <td className="td-date">{e.applied||'—'}</td>
                      <td className="td-date">{e.screen||'—'}</td>
                      <td className="td-date">{e.interviewDate||'—'}</td>
                      <td className="td-date">{e.offerDate?<span className="text-offer">{e.offerDate}</span>:'—'}</td>
                      <td className="td-date">{e.no?<span className="text-no">{e.no}</span>:'—'}</td>
                      <td className="td-days">{days!==null&&days>=0?days+'d':'—'}</td>
                      <td className="td-sm td-ats" title={e.ats}>{e.ats||'—'}</td>
                      <td className="td-sm">{e.status||'—'}</td>
                      <td className="td-flags">
                        {(e.flags||[]).map(f=><span key={f} className={`flag-badge ${FLAG_META[f]?.cls}`}>{FLAG_META[f]?.label}</span>)}
                        {e.screen&&!e.interviewDate&&<span className="flag-badge fl-screen">Screened</span>}
                      </td>
                      <td><button className="btn-edit" onClick={()=>setEditEntry({...e})}>Edit</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pager">
            <button className="btn-ghost small" onClick={()=>setPage(p=>Math.max(0,p-1))} disabled={page===0}>‹ Prev</button>
            <span>Page {page+1} of {totalPages}</span>
            <button className="btn-ghost small" onClick={()=>setPage(p=>p+1)} disabled={page+1>=totalPages}>Next ›</button>
          </div>
        </div>
      )}

      {editEntry && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setEditEntry(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Edit Entry</h2>
              <button className="modal-close" onClick={()=>setEditEntry(null)}>✕</button>
            </div>
            <div className="modal-body">
              <EntryForm entry={editEntry} onChange={setEditEntry}
                onSave={handleSaveEdit} onCancel={()=>setEditEntry(null)}
                saving={saving} orgSuggestions={orgSuggestions} atsSuggestions={atsSuggestions}/>
              <div className="danger-zone">
                <button className="btn-danger" onClick={handleDeleteEntry}>Delete this entry</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

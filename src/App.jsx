import React, { useState, useMemo, useRef } from 'react'
import { parseWorkbook, buildExport } from './excel'

const STATUS_OPTIONS = [
  '', 'Applied', 'Screening', 'Phone Screen', 'Interviewing',
  'Final Round', 'Offer Received', 'Accepted', 'Declined Offer',
  'Rejected', 'Withdrew', 'No Response',
]
const FLAG_META = {
  'li-on':  { label: 'LinkedIn ON',  cls: 'fl-li-on'  },
  'li-off': { label: 'LinkedIn OFF', cls: 'fl-li-off'  },
  'indeed': { label: 'Indeed ON',    cls: 'fl-indeed'  },
  'street': { label: 'Street Addr',  cls: 'fl-street'  },
}
const ATS_SUGGESTIONS = [
  'Workday','Greenhouse','LinkedIn Easy Apply','SuccessFactors','iCIMS',
  'Taleo','Brassring','Oracle Recruiting Cloud','Lever','Jobvite',
  'SmartRecruiters','Ashby','Avature','Phenom','Dayforce','UKG',
  'BambooHR','Rippling','Workable','ADP','Eightfold','Paradox','Email',
]
const PER_PAGE = 30

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
        </div>
      </div>

      {tab==='new' && (
        <div className="panel">
          <h2 className="panel-title">New Application</h2>
          <EntryForm entry={newEntry} onChange={setNewEntry} onSave={handleAddEntry}
            saving={saving} orgSuggestions={orgSuggestions} atsSuggestions={atsSuggestions}/>
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

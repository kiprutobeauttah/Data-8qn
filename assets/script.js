/* Author: Beauttah | Meru University | Data-8qn
   Main script: parsing, render, stats, charting, theme toggle */

let data = [];
let headers = [];
let filtered = [];
let sortState = { key: null, dir: 1 };
let page = 1;
let pageSize = 25;
let chartInstance = null;
let chartCtx = null;
let loadStart = 0;

const fileInput = document.getElementById('fileInput');
const dropArea = document.getElementById('dropArea');
const tableCard = document.getElementById('tableCard');
const dataTable = document.getElementById('dataTable');
const searchEl = document.getElementById('search');
const pageSizeEl = document.getElementById('pageSize');
const rowInfo = document.getElementById('rowInfo');
const pageLabel = document.getElementById('pageLabel');
const prevPage = document.getElementById('prevPage');
const nextPage = document.getElementById('nextPage');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const totalRowsEl = document.getElementById('totalRows');
const totalColsEl = document.getElementById('totalCols');
const loadTimeEl = document.getElementById('loadTime');
const chartColumn = document.getElementById('chartColumn');
const summaryChartEl = document.getElementById('summaryChart');
const themeToggle = document.getElementById('themeToggle');

function init(){
  chartCtx = summaryChartEl.getContext('2d');
  setupTheme();
  attachEvents();
}
function setupTheme(){
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const saved = localStorage.getItem('data8qn-theme');
  if(saved) document.documentElement.setAttribute('data-theme', saved);
  else if(prefersDark) document.documentElement.setAttribute('data-theme','dark');
  // update icon
  updateThemeIcon();
}
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') || 'light';
  const next = cur==='light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('data8qn-theme', next);
  updateThemeIcon();
}
function updateThemeIcon(){
  const t = document.documentElement.getAttribute('data-theme') || 'light';
  themeToggle.textContent = t==='dark' ? '☀️' : '🌙';
}

function attachEvents(){
  themeToggle.addEventListener('click', toggleTheme);
  fileInput.addEventListener('change', ()=>{ if(fileInput.files.length) handleFile(fileInput.files[0]); fileInput.value=''; });
  ['dragenter','dragover','dragleave','drop'].forEach(ev => dropArea.addEventListener(ev, evHandler));
  dropArea.addEventListener('drop', (e)=>{ const f = e.dataTransfer.files[0]; if(f) handleFile(f); });
  dropArea.addEventListener('click', ()=>fileInput.click());
  searchEl.addEventListener('input', ()=>{ page=1; applyFilter(); });
  pageSizeEl.addEventListener('change', ()=>{ pageSize = Number(pageSizeEl.value); page=1; renderTable(); });
  prevPage.addEventListener('click', ()=>{ if(page>1){ page--; renderTable(); } });
  nextPage.addEventListener('click', ()=>{ const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize)); if(page<totalPages){ page++; renderTable(); } });
  downloadBtn.addEventListener('click', downloadCSV);
  clearBtn.addEventListener('click', ()=>{ data=[]; headers=[]; filtered=[]; tableCard.classList.add('hidden'); searchEl.value=''; rowInfo.textContent='0 rows'; pageLabel.textContent='Page 0 / 0'; totalRowsEl.textContent='0'; totalColsEl.textContent='0'; loadTimeEl.textContent='0ms'; chartColumn.innerHTML=''; destroyChart(); });
  chartColumn.addEventListener('change', ()=>renderChart(chartColumn.value));
  window.addEventListener('keydown', (e)=>{ if(e.key === '/' && document.activeElement !== searchEl){ e.preventDefault(); searchEl.focus(); } });
}

function evHandler(e){ e.preventDefault(); e.stopPropagation(); }

function handleFile(file){
  const name = file.name.toLowerCase();
  loadStart = performance.now();
  if(name.endsWith('.csv') || name.endsWith('.txt')) parseCSV(file);
  else if(name.endsWith('.xls') || name.endsWith('.xlsx') || name.endsWith('.ods')) parseXLS(file);
  else alert('Unsupported file type. Use CSV, XLS, XLSX, or ODS.');
}

function parseCSV(file){
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      headers = results.meta.fields || [];
      data = results.data.map(r => normalizeRow(r, headers));
      afterLoad();
    },
    error: (err) => alert('Parse error: '+err.message)
  });
}

function parseXLS(file){
  const reader = new FileReader();
  reader.onload = (e) => {
    const workbook = XLSX.read(e.target.result, { type: 'array' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    headers = json.length ? Object.keys(json[0]) : [];
    data = json.map(r => normalizeRow(r, headers));
    afterLoad();
  };
  reader.readAsArrayBuffer(file);
}

function normalizeRow(row, headers){
  const out = {}; headers.forEach(h => { out[h] = (row[h] === undefined || row[h] === null) ? '' : String(row[h]); }); return out;
}

function afterLoad(){
  sortState = {key:null,dir:1}; page = 1; applyFilter(); showTable(); updateStats(); populateChartColumns(); renderChartOptions();
  const loadTime = Math.round(performance.now() - loadStart); loadTimeEl.textContent = loadTime + 'ms';
}

function showTable(){ tableCard.classList.toggle('hidden', data.length === 0); }

function applyFilter(){
  const q = (searchEl.value || '').trim().toLowerCase();
  if(!q) filtered = data.slice();
  else filtered = data.filter(row => headers.some(h => (row[h]||'').toLowerCase().includes(q)));
  applySort(); renderTable(); updateStats(); renderChartOptions();
}

function applySort(){
  if(!sortState.key) return;
  const key = sortState.key; const dir = sortState.dir;
  filtered.sort((a,b)=>{
    const va = a[key]||''; const vb = b[key]||'';
    const na = parseFloat(va.replace(/[^0-9.-]/g,'')); const nb = parseFloat(vb.replace(/[^0-9.-]/g,''));
    if(!isNaN(na) && !isNaN(nb)) return (na-nb)*dir;
    return va.localeCompare(vb)*dir;
  });
}

function toggleSort(key){ if(sortState.key===key) sortState.dir = -sortState.dir; else { sortState.key = key; sortState.dir = 1; } page = 1; applySort(); renderTable(); }

function renderTable(){
  dataTable.innerHTML = '';
  if(!filtered.length){ dataTable.innerHTML = '<thead><tr><th>No data to display</th></tr></thead>'; rowInfo.textContent='0 rows'; pageLabel.textContent='Page 0 / 0'; return; }
  const thead = document.createElement('thead'); const tr = document.createElement('tr');
  headers.forEach(h=>{ const th = document.createElement('th'); th.textContent = h; const span = document.createElement('span'); span.className='sort'; if(sortState.key===h) span.textContent = sortState.dir===1 ? ' ▲' : ' ▼'; th.appendChild(span); th.addEventListener('click', ()=>toggleSort(h)); tr.appendChild(th); });
  thead.appendChild(tr); dataTable.appendChild(thead);

  const tbody = document.createElement('tbody');
  const total = filtered.length; const totalPages = Math.max(1, Math.ceil(total/pageSize));
  if(page>totalPages) page = totalPages;
  const start = (page-1)*pageSize; const end = Math.min(total, start+pageSize);
  for(let i=start;i<end;i++){ const row = filtered[i]; const tr = document.createElement('tr'); headers.forEach(h=>{ const td = document.createElement('td'); td.textContent = row[h] || ''; tr.appendChild(td); }); tbody.appendChild(tr); }
  dataTable.appendChild(tbody);

  rowInfo.textContent = `${total} rows — showing ${start+1}-${end}`;
  pageLabel.textContent = `Page ${page} / ${totalPages}`;
}

function updateStats(){
  totalRowsEl.textContent = data.length;
  totalColsEl.textContent = headers.length;
}

function populateChartColumns(){
  chartColumn.innerHTML = '<option value="">-- select column --</option>';
  headers.forEach(h=>{
    const opt = document.createElement('option'); opt.value = h; opt.textContent = h; chartColumn.appendChild(opt);
  });
}

function renderChartOptions(){
  // Also used to update Visualize page selections
  const sel = document.getElementById('vizColumn'); if(sel){
    sel.innerHTML = '<option value="">-- select column --</option>';
    headers.forEach(h=>{ const o = document.createElement('option'); o.value = h; o.textContent = h; sel.appendChild(o); });
  }
}

function renderChart(column){
  if(!column) { destroyChart(); return; }
  // compute frequency map for values in column (top 10)
  const freq = {};
  filtered.forEach(r=>{ const v = (r[column]||'').trim(); if(v==='') return; freq[v] = (freq[v]||0)+1; });
  const pairs = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,10);
  const labels = pairs.map(p=>p[0]); const values = pairs.map(p=>p[1]);
  const cfg = {
    type: 'bar',
    data: { labels, datasets: [{ label: column, data: values, backgroundColor: undefined }] },
    options: { responsive:true, maintainAspectRatio:false }
  };
  if(chartInstance) chartInstance.destroy();
  chartInstance = new Chart(chartCtx, cfg);
}

function destroyChart(){ if(chartInstance){ chartInstance.destroy(); chartInstance = null; } }

function downloadCSV(){
  if(!filtered.length){ alert('No data to download'); return; }
  const rows = [headers].concat(filtered.map(r=> headers.map(h=> r[h] )));
  const csv = rows.map(r=> r.map(c=> '"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'data-export.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// Visualize page quick helper
function buildChartOnVisualize(ctx, labels, values, title){
  if(window.vizChart) window.vizChart.destroy();
  window.vizChart = new Chart(ctx, { type:'pie', data:{ labels, datasets:[{ data: values }] }, options:{ responsive:true, plugins:{ title:{ display:!!title, text:title } } } });
}

// Init on load
document.addEventListener('DOMContentLoaded', init);


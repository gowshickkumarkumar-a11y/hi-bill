/**
 * Member Count & Day Amount Tracker
 * Full Day (+1 day, +Day Amount) & Half Day (+0.5 day, +Half Day Amount)
 */

const STORAGE_KEY = 'member_count_amount_data_v2';

// Default initial data
const DEFAULT_DATA = {
  settings: {
    currency: '₹',
    dayAmount: 100,
    halfDayAmount: 50,
    title: 'Member Count & Day Amount Tracker'
  },
  members: [
    { id: 'm_1', name: 'Ramesh Kumar', phone: '9845012345', active: true },
    { id: 'm_2', name: 'Suresh Babu', phone: '9845054321', active: true },
    { id: 'm_3', name: 'Anand Sharma', phone: '9740112233', active: true },
    { id: 'm_4', name: 'Priya Rajan', phone: '9988776655', active: true },
    { id: 'm_5', name: 'Vijay Murugan', phone: '9123456789', active: true }
  ],
  dailyEntries: {}
};

// Global in-memory app state
let appState = null;
let currentDate = '';
let currentMonth = '';
let activeTab = 'daily';
let chartInstance = null;

// Initialize on document ready
document.addEventListener('DOMContentLoaded', async () => {
  const today = new Date();
  currentDate = formatDateToISO(today);
  currentMonth = currentDate.slice(0, 7);

  // Initialize UI inputs with today's date
  document.getElementById('selectedDateInput').value = currentDate;
  document.getElementById('monthlyFilterPicker').value = currentMonth;
  document.getElementById('summaryMonthFilterPicker').value = currentMonth;

  // Load data from Server Database or LocalStorage
  await loadData();

  // Populate Day Amount & Half Day Amount
  const currency = appState.settings.currency || '₹';
  document.getElementById('currencySelector').value = currency;
  updateCurrencyDisplay();

  // Seed sample records if empty
  seedSampleEntriesIfEmpty();

  // Load selected date entry into UI
  loadDayEntry(currentDate);

  // Initial render
  renderAllViews();

  if (window.lucide) {
    window.lucide.createIcons();
  }
});

// Helper: Format Date object to YYYY-MM-DD
function formatDateToISO(dateObj) {
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Helper: Friendly formatted date
function formatFriendlyDate(isoDateStr) {
  if (!isoDateStr) return '';
  const parts = isoDateStr.split('-');
  if (parts.length !== 3) return isoDateStr;
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    weekday: 'short'
  });
}

// Load data from Server Database (database.json) or LocalStorage
async function loadData() {
  // 1. First load from localStorage for instant offline access
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      appState = JSON.parse(raw);
    } else {
      appState = JSON.parse(JSON.stringify(DEFAULT_DATA));
    }
  } catch (e) {
    appState = JSON.parse(JSON.stringify(DEFAULT_DATA));
  }

  // Ensure default amounts exist
  if (!appState.settings) appState.settings = {};
  if (appState.settings.dayAmount === undefined) appState.settings.dayAmount = 100;
  if (appState.settings.halfDayAmount === undefined) appState.settings.halfDayAmount = 50;
  if (!appState.settings.currency) appState.settings.currency = '₹';

  // 2. Sync with local backend database.json
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const serverData = await res.json();
      if (serverData && serverData.members && serverData.dailyEntries) {
        appState = serverData;
        if (!appState.settings) appState.settings = {};
        if (appState.settings.dayAmount === undefined) appState.settings.dayAmount = 100;
        if (appState.settings.halfDayAmount === undefined) appState.settings.halfDayAmount = 50;
        if (!appState.settings.currency) appState.settings.currency = '₹';
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
        
        // Show database status badge
        const badge = document.getElementById('dbStatusBadge');
        const dbProvider = res.headers.get('X-Database-Provider');
        if (badge) {
          badge.classList.remove('hidden');
          const textEl = badge.querySelector('span:last-child');
          if (textEl) {
            textEl.textContent = dbProvider === 'turso' ? 'DB: Turso Cloud (bill-gowshick)' : 'DB: database.json';
          }
        }
      }
    }
  } catch (err) {
    console.log('Running in standalone mode.');
  }
}

// Save data to LocalStorage AND database.json file
function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));

    fetch('/api/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appState)
    }).catch(err => {
      // Offline fallback
    });
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

// Seed sample records for recent days if empty
function seedSampleEntriesIfEmpty() {
  if (Object.keys(appState.dailyEntries).length > 0) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const currentDayNum = today.getDate();
  const dayAmt = appState.settings.dayAmount || 100;
  const halfAmt = appState.settings.halfDayAmount || 50;

  for (let i = Math.max(1, currentDayNum - 4); i <= currentDayNum; i++) {
    const d = new Date(year, month, i);
    const dateStr = formatDateToISO(d);
    
    // Sample status: 3 full day, 1 half day, 1 absent
    const attendance = {
      'm_1': 'full',
      'm_2': 'full',
      'm_3': i % 2 === 0 ? 'half' : 'full',
      'm_4': i % 2 === 0 ? 'full' : 'half',
      'm_5': 'absent'
    };

    let fullCount = 0;
    let halfCount = 0;
    Object.values(attendance).forEach(status => {
      if (status === 'full') fullCount++;
      if (status === 'half') halfCount++;
    });

    const totalHeadcount = fullCount + (halfCount * 0.5);
    const totalDayAmount = (fullCount * dayAmt) + (halfCount * halfAmt);

    appState.dailyEntries[dateStr] = {
      date: dateStr,
      mode: 'members',
      attendance: attendance,
      fullDayCount: fullCount,
      halfDayCount: halfCount,
      totalHeadcount: totalHeadcount,
      dayAmount: dayAmt,
      halfDayAmount: halfAmt,
      totalDayAmount: totalDayAmount,
      note: i === currentDayNum ? "Today's log" : "Regular log"
    };
  }
  saveData();
}

// ==========================================
// Currency & Global Rates
// ==========================================
function changeCurrency(newCurr) {
  appState.settings.currency = newCurr;
  saveData();
  updateCurrencyDisplay();
  renderAllViews();
  showToast(`Currency updated to ${newCurr}`);
}

function updateCurrencyDisplay() {
  const sym = appState.settings.currency || '₹';
  document.querySelectorAll('.currency-symbol').forEach(el => {
    el.textContent = sym;
  });
}

// ==========================================
// Customer Daily Rate Setting
// (Stays fixed across all days until the customer changes it)
// ==========================================
function openRateModal() {
  const currentDayAmt = appState.settings.dayAmount !== undefined ? appState.settings.dayAmount : 100;
  const currentHalfAmt = appState.settings.halfDayAmount !== undefined ? appState.settings.halfDayAmount : 50;

  document.getElementById('modalDayAmountInput').value = currentDayAmt;
  document.getElementById('modalHalfDayAmountInput').value = currentHalfAmt;
  document.getElementById('rateModal').classList.remove('hidden');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Backward-compatible alias
function openOwnerRateModal() {
  openRateModal();
}

function closeRateModal() {
  document.getElementById('rateModal').classList.add('hidden');
}

function closeOwnerRateModal() {
  closeRateModal();
}

function onModalDayAmountInput(val) {
  const amount = Math.max(0, parseFloat(val) || 0);
  document.getElementById('modalHalfDayAmountInput').value = Math.round(amount / 2);
}

function saveRateModal() {
  const dayAmt = Math.max(0, parseFloat(document.getElementById('modalDayAmountInput').value) || 0);
  const halfAmt = Math.max(0, parseFloat(document.getElementById('modalHalfDayAmountInput').value) || 0);

  appState.settings.dayAmount = dayAmt;
  appState.settings.halfDayAmount = halfAmt;

  // Update current date entry
  const entry = getOrCreateCurrentDayEntry();
  entry.dayAmount = dayAmt;
  entry.halfDayAmount = halfAmt;

  saveData();
  closeRateModal();
  renderAllViews();
  showToast(`Amount updated: Day ${appState.settings.currency || '₹'}${dayAmt} • Half Day ${appState.settings.currency || '₹'}${halfAmt}`);
}

function saveOwnerRates() {
  saveRateModal();
}

// ==========================================
// Tab Switching
// ==========================================
function switchTab(tabName) {
  activeTab = tabName;
  const tabs = ['daily', 'monthly', 'members', 'summary'];
  
  tabs.forEach(t => {
    const btn = document.getElementById(`tabBtn-${t}`);
    const content = document.getElementById(`tabContent-${t}`);
    if (!btn || !content) return;

    if (t === tabName) {
      btn.classList.add('active', 'border-indigo-600', 'text-indigo-600');
      btn.classList.remove('border-transparent', 'text-slate-500');
      content.classList.remove('hidden');
    } else {
      btn.classList.remove('active', 'border-indigo-600', 'text-indigo-600');
      btn.classList.add('border-transparent', 'text-slate-500');
      content.classList.add('hidden');
    }
  });

  if (tabName === 'monthly') {
    renderMonthlyView();
  } else if (tabName === 'members') {
    renderMembersDirectory();
  } else if (tabName === 'summary') {
    renderMemberAttendanceSlips();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// ==========================================
// Daily Entry & Attendance Logic
// ==========================================
function onDateChanged(newDate) {
  currentDate = newDate;
  currentMonth = newDate.slice(0, 7);
  document.getElementById('monthlyFilterPicker').value = currentMonth;
  document.getElementById('summaryMonthFilterPicker').value = currentMonth;
  loadDayEntry(currentDate);
  updateKPIs();
}

function navigateDay(offsetDays) {
  const [y, m, d] = currentDate.split('-').map(Number);
  const targetDate = new Date(y, m - 1, d + offsetDays);
  const newDateStr = formatDateToISO(targetDate);
  document.getElementById('selectedDateInput').value = newDateStr;
  onDateChanged(newDateStr);
}

function goToToday() {
  const todayStr = formatDateToISO(new Date());
  document.getElementById('selectedDateInput').value = todayStr;
  onDateChanged(todayStr);
}

// Load entry for a date
function loadDayEntry(dateStr) {
  document.getElementById('currentDateDisplay').textContent = formatFriendlyDate(dateStr);
  
  let entry = appState.dailyEntries[dateStr];
  const defaultDayAmt = appState.settings.dayAmount !== undefined ? appState.settings.dayAmount : 100;
  const defaultHalfAmt = appState.settings.halfDayAmount !== undefined ? appState.settings.halfDayAmount : 50;

  if (!entry) {
    entry = {
      date: dateStr,
      mode: 'members',
      attendance: {},
      fullDayCount: 0,
      halfDayCount: 0,
      totalHeadcount: 0,
      dayAmount: defaultDayAmt,
      halfDayAmount: defaultHalfAmt,
      totalDayAmount: 0,
      note: ''
    };
  }

  // Normalize legacy data if present
  if (!entry.attendance) entry.attendance = {};
  if (entry.presentMemberIds && Object.keys(entry.attendance).length === 0) {
    entry.presentMemberIds.forEach(id => {
      entry.attendance[id] = 'full';
    });
  }

  // Display fixed day amount & half day amount (set by owner)
  const currentDayAmt = entry.dayAmount !== undefined ? entry.dayAmount : defaultDayAmt;
  const currentHalfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : defaultHalfAmt;
  
  const dispDay = document.getElementById('displayDayAmount');
  if (dispDay) dispDay.textContent = currentDayAmt;
  const dispHalf = document.getElementById('displayHalfDayAmount');
  if (dispHalf) dispHalf.textContent = currentHalfAmt;
  
  const quickFullBadge = document.getElementById('quickFullRateBadge');
  if (quickFullBadge) quickFullBadge.textContent = currentDayAmt;
  const quickHalfBadge = document.getElementById('quickHalfRateBadge');
  if (quickHalfBadge) quickHalfBadge.textContent = currentHalfAmt;
  const quickCountFull = document.getElementById('quickCountFullAmountLabel');
  if (quickCountFull) quickCountFull.textContent = currentDayAmt;
  const quickCountHalf = document.getElementById('quickCountHalfAmountLabel');
  if (quickCountHalf) quickCountHalf.textContent = currentHalfAmt;

  // Populate mode
  setEntryMode(entry.mode || 'members', false);

  // Populate quick headcount inputs
  document.getElementById('quickFullDayInput').value = entry.fullDayCount || 0;
  document.getElementById('quickHalfDayInput').value = entry.halfDayCount || 0;

  // Populate note
  document.getElementById('dailyNoteInput').value = entry.note || '';

  // Render Member Attendance List (Full Day / Half Day / Absent)
  renderDailyMembersChecklist(entry.attendance);

  // Calculate & render totals
  calculateAndRenderDailyTotal();
}

// Switch between Named Members checklist vs Quick Headcount mode
function setEntryMode(mode, triggerSave = true) {
  const modeBtnMembers = document.getElementById('modeBtn-members');
  const modeBtnHeadcount = document.getElementById('modeBtn-headcount');
  const sectionMembers = document.getElementById('modeSection-members');
  const sectionHeadcount = document.getElementById('modeSection-headcount');

  if (mode === 'members') {
    modeBtnMembers.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center bg-white text-indigo-700 shadow-sm';
    modeBtnHeadcount.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center text-slate-600 hover:text-slate-900';
    sectionMembers.classList.remove('hidden');
    sectionHeadcount.classList.add('hidden');
  } else {
    modeBtnMembers.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center text-slate-600 hover:text-slate-900';
    modeBtnHeadcount.className = 'px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center bg-white text-indigo-700 shadow-sm';
    sectionMembers.classList.add('hidden');
    sectionHeadcount.classList.remove('hidden');
  }

  const entry = getOrCreateCurrentDayEntry();
  entry.mode = mode;

  calculateAndRenderDailyTotal();

  if (triggerSave) {
    saveCurrentDayEntry(false);
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Render members cards with 3 clear buttons: Full Day, Half Day, Absent
function renderDailyMembersChecklist(attendanceMap = {}) {
  const grid = document.getElementById('dailyMembersGrid');
  const emptyAlert = document.getElementById('emptyMembersAlert');
  const activeMembers = appState.members.filter(m => m.active !== false);

  if (activeMembers.length === 0) {
    grid.innerHTML = '';
    emptyAlert.classList.remove('hidden');
    return;
  }
  emptyAlert.classList.add('hidden');

  const entry = getOrCreateCurrentDayEntry();
  const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
  const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);
  const curr = appState.settings.currency || '₹';

  grid.innerHTML = activeMembers.map(member => {
    const status = attendanceMap[member.id] || 'absent'; // 'full' | 'half' | 'absent'

    let borderClass = 'border-slate-200 bg-white';
    let statusBadge = '<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-400">Absent (0)</span>';

    if (status === 'full') {
      borderClass = 'border-emerald-400 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-300';
      statusBadge = `<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">Full Day (+${curr}${dayAmt})</span>`;
    } else if (status === 'half') {
      borderClass = 'border-amber-400 bg-amber-50/70 shadow-xs ring-1 ring-amber-300';
      statusBadge = `<span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-900">Half Day (+${curr}${halfAmt})</span>`;
    }

    return `
      <div class="border rounded-2xl p-3.5 flex flex-col justify-between transition ${borderClass}" id="memberCard-${member.id}">
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <h4 class="font-extrabold text-sm text-slate-900 truncate">${escapeHTML(member.name)}</h4>
            ${statusBadge}
          </div>
          <p class="text-[11px] text-slate-400 mb-3">${member.phone ? escapeHTML(member.phone) : 'Member'}</p>
        </div>

        <!-- 3 Interactive Status Buttons -->
        <div class="grid grid-cols-3 gap-1.5 bg-slate-100/80 p-1 rounded-xl">
          <button onclick="setMemberStatus('${member.id}', 'full')" class="py-1 px-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
            status === 'full'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white hover:text-emerald-700'
          }">
            Full Day
          </button>
          
          <button onclick="setMemberStatus('${member.id}', 'half')" class="py-1 px-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
            status === 'half'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'text-slate-600 hover:bg-white hover:text-amber-800'
          }">
            Half Day
          </button>
          
          <button onclick="setMemberStatus('${member.id}', 'absent')" class="py-1 px-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center ${
            status === 'absent'
              ? 'bg-white text-slate-700 shadow-xs'
              : 'text-slate-400 hover:bg-white hover:text-slate-700'
          }">
            Absent
          </button>
        </div>

        <!-- Direct WhatsApp / SMS Notification for Present Workers -->
        ${(status === 'full' || status === 'half') ? `
          <div class="mt-2.5 pt-2 border-t border-slate-200/80 flex items-center justify-between">
            <span class="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Send confirmation:</span>
            <div class="flex items-center space-x-1">
              <button onclick="sendMemberAttendanceMessage('${member.id}', 'whatsapp')" title="Send WhatsApp message to ${escapeHTML(member.name)}" class="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-extrabold flex items-center shadow-xs transition">
                WhatsApp
              </button>
              <button onclick="sendMemberAttendanceMessage('${member.id}', 'sms')" title="Send SMS message to ${escapeHTML(member.name)}" class="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-extrabold flex items-center shadow-xs transition">
                SMS
              </button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// Filter members by search input
function filterDailyMemberList(query) {
  const q = query.toLowerCase().trim();
  const cards = document.querySelectorAll('#dailyMembersGrid > div');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? 'flex' : 'none';
  });
}

// Set status for individual member: 'full' | 'half' | 'absent'
function setMemberStatus(memberId, newStatus) {
  const entry = getOrCreateCurrentDayEntry();
  if (!entry.attendance) entry.attendance = {};

  entry.attendance[memberId] = newStatus;

  // Re-render checklist and compute daily totals
  renderDailyMembersChecklist(entry.attendance);
  calculateAndRenderDailyTotal();
  saveCurrentDayEntry(false);
}

// Batch set all members to: 'full' | 'half' | 'absent'
function batchSetAttendance(targetStatus) {
  const entry = getOrCreateCurrentDayEntry();
  if (!entry.attendance) entry.attendance = {};

  const activeMembers = appState.members.filter(m => m.active !== false);
  activeMembers.forEach(m => {
    entry.attendance[m.id] = targetStatus;
  });

  renderDailyMembersChecklist(entry.attendance);
  calculateAndRenderDailyTotal();
  saveCurrentDayEntry(false);
  
  if (targetStatus === 'full') showToast('Marked all members as Full Day');
  else if (targetStatus === 'half') showToast('Marked all members as Half Day');
  else showToast('Cleared all members to Absent');
}

// Quick Headcount Mode adjusters
function adjustQuickCount(type, delta) {
  const inputId = type === 'full' ? 'quickFullDayInput' : 'quickHalfDayInput';
  const input = document.getElementById(inputId);
  let currentVal = parseInt(input.value) || 0;
  currentVal = Math.max(0, currentVal + delta);
  input.value = currentVal;
  onQuickCountInputChanged();
}

function onQuickCountInputChanged() {
  const fullVal = Math.max(0, parseInt(document.getElementById('quickFullDayInput').value) || 0);
  const halfVal = Math.max(0, parseInt(document.getElementById('quickHalfDayInput').value) || 0);

  const entry = getOrCreateCurrentDayEntry();
  entry.fullDayCount = fullVal;
  entry.halfDayCount = halfVal;

  calculateAndRenderDailyTotal();
  saveCurrentDayEntry(false);
}

// Helper: Get or initialize today's entry in appState
function getOrCreateCurrentDayEntry() {
  if (!appState.dailyEntries[currentDate]) {
    const dayAmt = appState.settings.dayAmount !== undefined ? appState.settings.dayAmount : 100;
    const halfAmt = appState.settings.halfDayAmount !== undefined ? appState.settings.halfDayAmount : 50;

    appState.dailyEntries[currentDate] = {
      date: currentDate,
      mode: 'members',
      attendance: {},
      fullDayCount: 0,
      halfDayCount: 0,
      totalHeadcount: 0,
      dayAmount: dayAmt,
      halfDayAmount: halfAmt,
      totalDayAmount: 0,
      note: ''
    };
  }
  return appState.dailyEntries[currentDate];
}

// Real-time calculation of daily total members and amount
function calculateAndRenderDailyTotal() {
  const entry = getOrCreateCurrentDayEntry();
  const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
  const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);
  
  entry.dayAmount = dayAmt;
  entry.halfDayAmount = halfAmt;
  entry.note = document.getElementById('dailyNoteInput').value || '';

  let fullCount = 0;
  let halfCount = 0;

  if (entry.mode === 'members') {
    if (!entry.attendance) entry.attendance = {};
    // Only count attendance for members that still exist
    const activeMemberIds = new Set(appState.members.filter(m => m.active !== false).map(m => m.id));
    // Clean out deleted member IDs from attendance
    Object.keys(entry.attendance).forEach(memberId => {
      if (!activeMemberIds.has(memberId)) {
        delete entry.attendance[memberId];
      }
    });
    Object.values(entry.attendance).forEach(status => {
      if (status === 'full') fullCount++;
      if (status === 'half') halfCount++;
    });
    entry.fullDayCount = fullCount;
    entry.halfDayCount = halfCount;
  } else {
    fullCount = parseInt(document.getElementById('quickFullDayInput').value) || 0;
    halfCount = parseInt(document.getElementById('quickHalfDayInput').value) || 0;
    entry.fullDayCount = fullCount;
    entry.halfDayCount = halfCount;
  }

  // Total headcount: Full Day = 1.0, Half Day = 0.5
  const totalHeadcount = fullCount + (halfCount * 0.5);
  // Total amount added: (Full * Day Amount) + (Half * Half Day Amount)
  const totalDayAmount = (fullCount * dayAmt) + (halfCount * halfAmt);

  entry.totalHeadcount = totalHeadcount;
  entry.totalDayAmount = totalDayAmount;

  // Update UI Elements
  document.getElementById('badgeDayTotalAmount').textContent = formatNumber(totalDayAmount);
  document.getElementById('statDayCount').textContent = totalHeadcount;
  document.getElementById('statDayBreakdownLabel').textContent = `${fullCount} Full • ${halfCount} Half Day`;
  document.getElementById('statDayAmount').textContent = formatNumber(totalDayAmount);
  document.getElementById('statDayRateDetail').textContent = `Day: ${appState.settings.currency}${dayAmt} • Half: ${appState.settings.currency}${halfAmt}`;
  
  // Quick count summary box
  const quickSumHeadcount = document.getElementById('quickSummaryTotalHeadcount');
  if (quickSumHeadcount) quickSumHeadcount.textContent = `${totalHeadcount} days (${fullCount} Full + ${halfCount} Half)`;
  const quickSumAmount = document.getElementById('quickSummaryTotalAmount');
  if (quickSumAmount) quickSumAmount.textContent = formatNumber(totalDayAmount);

  // Update "Present Today" banner & Message hub badge
  const banner = document.getElementById('presentMembersBanner');
  const msgHubBadge = document.getElementById('msgHubBadgeCount');
  const presentTotal = fullCount + halfCount;

  if (msgHubBadge) msgHubBadge.textContent = presentTotal;

  if (banner) {
    if (presentTotal > 0) {
      banner.classList.remove('hidden');
      const countEl = document.getElementById('presentCountMsg');
      if (countEl) countEl.textContent = presentTotal;
      const bkdEl = document.getElementById('presentBreakdownMsg');
      if (bkdEl) bkdEl.textContent = `${fullCount} Full Day • ${halfCount} Half Day`;
      const amtEl = document.getElementById('presentAmountMsg');
      if (amtEl) amtEl.textContent = formatNumber(totalDayAmount);
    } else {
      banner.classList.add('hidden');
    }
  }

  updateKPIs();
}

// Save current day entry with toast notification
function saveCurrentDayEntry(showFeedback = true) {
  const entry = getOrCreateCurrentDayEntry();
  entry.dayAmount = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
  entry.halfDayAmount = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);
  entry.note = document.getElementById('dailyNoteInput').value || '';
  calculateAndRenderDailyTotal();
  saveData();

  if (showFeedback) {
    const indicator = document.getElementById('saveStatusIndicator');
    indicator.classList.remove('hidden');
    indicator.classList.add('inline-flex');
    setTimeout(() => {
      indicator.classList.add('hidden');
      indicator.classList.remove('inline-flex');
    }, 2000);

    showToast(`Saved ${formatFriendlyDate(currentDate)}: ${entry.totalHeadcount} days (Added: ${appState.settings.currency}${formatNumber(entry.totalDayAmount)})`);
  }

  // Refresh other views
  if (activeTab === 'monthly') renderMonthlyView();
  if (activeTab === 'members') renderMembersDirectory();
  if (activeTab === 'summary') renderMemberAttendanceSlips();
}

// ==========================================
// Top Overview KPIs (Day & Month Mound)
// ==========================================
function updateKPIs() {
  const currentMonthEntries = getEntriesForMonth(currentMonth);

  let monthHeadcountSum = 0;
  let monthAmountSum = 0;
  let activeDaysCount = 0;

  Object.values(currentMonthEntries).forEach(e => {
    if ((e.totalHeadcount && e.totalHeadcount > 0) || (e.totalDayAmount && e.totalDayAmount > 0)) {
      activeDaysCount++;
    }
    monthHeadcountSum += (e.totalHeadcount || 0);
    monthAmountSum += (e.totalDayAmount || 0);
  });

  document.getElementById('statMonthCount').textContent = monthHeadcountSum;
  document.getElementById('statMonthAmount').textContent = formatNumber(monthAmountSum);
  document.getElementById('statMonthDaysRecorded').textContent = `${activeDaysCount} active days recorded`;

  const monthObj = new Date(`${currentMonth}-01`);
  const monthName = monthObj.toLocaleString('en-GB', { month: 'long', year: 'numeric' });
  document.getElementById('statMonthLabel').textContent = `Total Amount for ${monthName}`;
  
  const activeMembersCount = appState.members.filter(m => m.active !== false).length;
  document.getElementById('tabMemberCountBadge').textContent = activeMembersCount;
}

// ==========================================
// TAB 2: Monthly Report & Date Totals Breakdown
// ==========================================
function onMonthFilterChanged(val) {
  currentMonth = val;
  renderMonthlyView();
  updateKPIs();
}

function getEntriesForMonth(monthStr) {
  const filtered = {};
  Object.keys(appState.dailyEntries).forEach(date => {
    if (date.startsWith(monthStr)) {
      filtered[date] = appState.dailyEntries[date];
    }
  });
  return filtered;
}

function renderMonthlyView() {
  const monthPicker = document.getElementById('monthlyFilterPicker');
  currentMonth = monthPicker.value || currentMonth;

  const [yearStr, monthStr] = currentMonth.split('-');
  const year = parseInt(yearStr);
  const month = parseInt(monthStr);

  const daysInMonth = new Date(year, month, 0).getDate();
  const monthObj = new Date(year, month - 1, 1);
  const monthLongTitle = monthObj.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  document.getElementById('monthlyTableTitle').textContent = monthLongTitle;

  let totalDaysLogged = 0;
  let totalFullDaysCount = 0;
  let totalHalfDaysCount = 0;
  let totalMonthDaysCount = 0;
  let totalMonthAmount = 0;

  const tableBody = document.getElementById('monthlyTableBody');
  let rowsHtml = '';

  const chartLabels = [];
  const chartAmounts = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
    const entry = appState.dailyEntries[dateKey];
    
    const rowDateObj = new Date(year, month - 1, day);
    const dayName = rowDateObj.toLocaleDateString('en-GB', { weekday: 'short' });
    const isWeekend = rowDateObj.getDay() === 0 || rowDateObj.getDay() === 6;

    chartLabels.push(String(day));

    if (entry && (entry.totalHeadcount > 0 || entry.totalDayAmount > 0)) {
      totalDaysLogged++;
      totalFullDaysCount += (entry.fullDayCount || 0);
      totalHalfDaysCount += (entry.halfDayCount || 0);
      totalMonthDaysCount += (entry.totalHeadcount || 0);
      totalMonthAmount += (entry.totalDayAmount || 0);

      chartAmounts.push(entry.totalDayAmount || 0);

      let attendeeDetails = '';
      if (entry.mode === 'members' && entry.attendance) {
        const fullNames = [];
        const halfNames = [];
        Object.keys(entry.attendance).forEach(id => {
          const m = appState.members.find(x => x.id === id);
          if (m) {
            if (entry.attendance[id] === 'full') fullNames.push(m.name);
            if (entry.attendance[id] === 'half') halfNames.push(m.name + ' (½)');
          }
        });
        attendeeDetails = [...fullNames, ...halfNames].join(', ');
      }
      if (entry.note) {
        attendeeDetails += (attendeeDetails ? ' • ' : '') + `<span class="italic text-slate-400">${escapeHTML(entry.note)}</span>`;
      }
      if (!attendeeDetails) attendeeDetails = '-';

      rowsHtml += `
        <tr class="hover:bg-slate-50/80 transition cursor-pointer" onclick="jumpToDate('${dateKey}')">
          <td class="py-3 px-4 font-bold text-slate-900">${dayStr}/${monthStr}/${yearStr}</td>
          <td class="py-3 px-4 font-semibold ${isWeekend ? 'text-rose-500' : 'text-slate-600'}">${dayName}</td>
          <td class="py-3 px-4 text-center">
            <span class="inline-flex px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              ${entry.fullDayCount || 0}
            </span>
          </td>
          <td class="py-3 px-4 text-center">
            <span class="inline-flex px-2 py-0.5 rounded-md text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
              ${entry.halfDayCount || 0}
            </span>
          </td>
          <td class="py-3 px-4 text-center font-black text-indigo-700 text-sm">
            ${entry.totalHeadcount || 0}
          </td>
          <td class="py-3 px-4 text-right font-black text-emerald-600">
            <span class="currency-symbol">${appState.settings.currency}</span>${formatNumber(entry.totalDayAmount || 0)}
          </td>
          <td class="py-3 px-4 max-w-xs truncate text-slate-600 text-xs" title="${escapeHTML(attendeeDetails)}">${attendeeDetails}</td>
          <td class="py-3 px-4 text-center">
            <button onclick="event.stopPropagation(); jumpToDate('${dateKey}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold p-1">
              Edit
            </button>
          </td>
        </tr>
      `;
    } else {
      chartAmounts.push(0);

      rowsHtml += `
        <tr class="hover:bg-slate-50/50 transition opacity-50 cursor-pointer" onclick="jumpToDate('${dateKey}')">
          <td class="py-2.5 px-4 text-slate-500">${dayStr}/${monthStr}/${yearStr}</td>
          <td class="py-2.5 px-4 ${isWeekend ? 'text-rose-400' : 'text-slate-400'}">${dayName}</td>
          <td class="py-2.5 px-4 text-center text-slate-400">0</td>
          <td class="py-2.5 px-4 text-center text-slate-400">0</td>
          <td class="py-2.5 px-4 text-center text-slate-400">0</td>
          <td class="py-2.5 px-4 text-right text-slate-400">0</td>
          <td class="py-2.5 px-4 text-slate-300 italic text-xs">No entry</td>
          <td class="py-2.5 px-4 text-center">
            <button onclick="event.stopPropagation(); jumpToDate('${dateKey}')" class="text-slate-400 hover:text-indigo-600 text-xs font-semibold">
              + Add
            </button>
          </td>
        </tr>
      `;
    }
  }

  tableBody.innerHTML = rowsHtml;

  // Monthly summary cards
  document.getElementById('monthlyReportDaysCount').textContent = totalDaysLogged;
  document.getElementById('monthlyReportFullCount').textContent = totalFullDaysCount;
  document.getElementById('monthlyReportHalfCount').textContent = totalHalfDaysCount;
  document.getElementById('monthlyReportTotalAmount').textContent = formatNumber(totalMonthAmount);

  // Footer totals
  document.getElementById('monthlyFooterFullCount').textContent = totalFullDaysCount;
  document.getElementById('monthlyFooterHalfCount').textContent = totalHalfDaysCount;
  document.getElementById('monthlyFooterTotalDays').textContent = `${totalMonthDaysCount} days`;
  document.getElementById('monthlyFooterTotalAmount').textContent = formatNumber(totalMonthAmount);

  // Update Monthly Chart
  renderMonthlyChart(chartLabels, chartAmounts);
}

// Render or update Chart.js daily amount graph
function renderMonthlyChart(labels, dataAmounts) {
  const canvas = document.getElementById('monthlyTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
  }

  const curr = appState.settings.currency || '₹';

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Day Amount Added',
        data: dataAmounts,
        backgroundColor: 'rgba(79, 70, 229, 0.75)',
        hoverBackgroundColor: 'rgba(79, 70, 229, 1)',
        borderRadius: 6,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Day ${items[0].label}`,
            label: (item) => `Amount Added: ${curr}${item.raw}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        },
        x: {
          grid: { display: false }
        }
      }
    }
  });
}

// Jump directly to edit a specific date
function jumpToDate(targetDateStr) {
  currentDate = targetDateStr;
  currentMonth = targetDateStr.slice(0, 7);
  document.getElementById('selectedDateInput').value = targetDateStr;
  switchTab('daily');
  loadDayEntry(targetDateStr);
}

// Export Monthly Data to Excel CSV
function exportMonthlyCSV() {
  const monthPicker = document.getElementById('monthlyFilterPicker');
  const monthKey = monthPicker.value || currentMonth;
  const [yearStr, monthStr] = monthKey.split('-');
  const daysInMonth = new Date(parseInt(yearStr), parseInt(monthStr), 0).getDate();

  const headers = ['Date', 'Day', 'Full Day Count', 'Half Day Count', 'Total Days', 'Day Amount Added', 'Attendees List / Notes'];
  const rows = [headers];

  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = String(day).padStart(2, '0');
    const dateKey = `${yearStr}-${monthStr}-${dayStr}`;
    const entry = appState.dailyEntries[dateKey];
    const rowDateObj = new Date(parseInt(yearStr), parseInt(monthStr) - 1, day);
    const dayName = rowDateObj.toLocaleDateString('en-GB', { weekday: 'short' });

    if (entry) {
      let attendees = '';
      if (entry.attendance) {
        const list = [];
        Object.keys(entry.attendance).forEach(id => {
          const m = appState.members.find(x => x.id === id);
          if (m && entry.attendance[id] !== 'absent') {
            list.push(`${m.name} (${entry.attendance[id]})`);
          }
        });
        attendees = list.join('; ');
      }
      if (entry.note) {
        attendees += (attendees ? ' | ' : '') + entry.note;
      }

      rows.push([
        dateKey,
        dayName,
        entry.fullDayCount || 0,
        entry.halfDayCount || 0,
        entry.totalHeadcount || 0,
        entry.totalDayAmount || 0,
        `"${attendees.replace(/"/g, '""')}"`
      ]);
    } else {
      rows.push([dateKey, dayName, 0, 0, 0, 0, '""']);
    }
  }

  const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `monthly_report_${monthKey}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Exported CSV for ${monthKey}`);
}

// ==========================================
// TAB 3: Members Directory Logic
// ==========================================
function renderMembersDirectory() {
  const tbody = document.getElementById('memberDirectoryTableBody');
  const search = (document.getElementById('memberDirectorySearch').value || '').toLowerCase().trim();

  const filteredMembers = appState.members.filter(m => {
    return m.name.toLowerCase().includes(search) || (m.phone && m.phone.toLowerCase().includes(search));
  });

  if (filteredMembers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-8 text-center text-slate-400">No members found matching your search.</td>
      </tr>
    `;
    return;
  }

  const monthEntries = getEntriesForMonth(currentMonth);

  tbody.innerHTML = filteredMembers.map((member, index) => {
    let fullDays = 0;
    let halfDays = 0;
    let memberAmount = 0;

    Object.values(monthEntries).forEach(entry => {
      const status = entry.attendance ? entry.attendance[member.id] : null;
      const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
      const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);

      if (status === 'full') {
        fullDays++;
        memberAmount += dayAmt;
      } else if (status === 'half') {
        halfDays++;
        memberAmount += halfAmt;
      }
    });

    const totalDays = fullDays + (halfDays * 0.5);
    const isActive = member.active !== false;

    return `
      <tr class="hover:bg-slate-50/80 transition">
        <td class="py-3 px-4 font-semibold text-slate-400">${index + 1}</td>
        <td class="py-3 px-4 font-bold text-slate-900">${escapeHTML(member.name)}</td>
        <td class="py-3 px-4 text-slate-600">${member.phone ? escapeHTML(member.phone) : '-'}</td>
        <td class="py-3 px-4 text-center">
          <span class="inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
            isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
          }">
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td class="py-3 px-4 text-center font-bold text-emerald-700">${fullDays}</td>
        <td class="py-3 px-4 text-center font-bold text-amber-700">${halfDays}</td>
        <td class="py-3 px-4 text-center font-black text-indigo-700">${totalDays} days</td>
        <td class="py-3 px-4 text-right font-black text-emerald-600"><span class="currency-symbol">${appState.settings.currency}</span>${formatNumber(memberAmount)}</td>
        <td class="py-3 px-4 text-center space-x-2">
          <button onclick="viewMemberMonthlySlip('${member.id}')" class="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition" title="View Slip">
            Slip
          </button>
          <button onclick="openEditMemberModal('${member.id}')" class="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition" title="Edit Member">
            Edit
          </button>
          <button onclick="deleteMember('${member.id}')" class="px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition" title="Delete Member">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterMemberDirectory() {
  renderMembersDirectory();
}

function openAddMemberModal() {
  document.getElementById('memberModalTitle').textContent = 'Add New Member';
  document.getElementById('memberFormId').value = '';
  document.getElementById('memberFormName').value = '';
  document.getElementById('memberFormPhone').value = '';
  document.getElementById('memberFormActive').checked = true;
  document.getElementById('memberModal').classList.remove('hidden');
}

function openEditMemberModal(memberId) {
  const member = appState.members.find(m => m.id === memberId);
  if (!member) return;

  document.getElementById('memberModalTitle').textContent = 'Edit Member';
  document.getElementById('memberFormId').value = member.id;
  document.getElementById('memberFormName').value = member.name;
  document.getElementById('memberFormPhone').value = member.phone || '';
  document.getElementById('memberFormActive').checked = member.active !== false;
  document.getElementById('memberModal').classList.remove('hidden');
}

function closeMemberModal() {
  document.getElementById('memberModal').classList.add('hidden');
}

function handleSaveMember(e) {
  e.preventDefault();
  const id = document.getElementById('memberFormId').value;
  const name = document.getElementById('memberFormName').value.trim();
  const phone = document.getElementById('memberFormPhone').value.trim();
  const active = document.getElementById('memberFormActive').checked;

  if (!name) return;

  if (id) {
    const existing = appState.members.find(m => m.id === id);
    if (existing) {
      existing.name = name;
      existing.phone = phone;
      existing.active = active;
      showToast(`Updated member: ${name}`);
    }
  } else {
    const newMember = {
      id: 'm_' + Date.now(),
      name,
      phone,
      active
    };
    appState.members.push(newMember);
    showToast(`Added new member: ${name}`);
  }

  saveData();
  closeMemberModal();
  renderAllViews();
}

function deleteMember(memberId) {
  const member = appState.members.find(m => m.id === memberId);
  if (!member) return;

  if (confirm(`Are you sure you want to delete member "${member.name}"?`)) {
    appState.members = appState.members.filter(m => m.id !== memberId);
    Object.values(appState.dailyEntries).forEach(entry => {
      if (entry.attendance && entry.attendance[memberId]) {
        delete entry.attendance[memberId];
      }
    });

    saveData();
    renderAllViews();
    showToast('Member deleted');
  }
}

// ==========================================
// TAB 4: Member Monthly Slips & Summary
// ==========================================
function onSummaryMonthChanged(val) {
  currentMonth = val;
  renderMemberAttendanceSlips();
}

function renderMemberAttendanceSlips() {
  const grid = document.getElementById('memberAttendanceGrid');
  const monthPicker = document.getElementById('summaryMonthFilterPicker');
  const targetMonth = monthPicker.value || currentMonth;
  const monthEntries = getEntriesForMonth(targetMonth);

  const [yearStr, monthStr] = targetMonth.split('-');
  const monthDate = new Date(parseInt(yearStr), parseInt(monthStr) - 1, 1);
  const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  if (appState.members.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-12 bg-white rounded-2xl border border-slate-200">
        <p class="text-slate-500 font-semibold text-sm">No members registered yet.</p>
      </div>
    `;
    return;
  }

  const curr = appState.settings.currency || '₹';

  grid.innerHTML = appState.members.map(member => {
    let fullDays = 0;
    let halfDays = 0;
    let totalAmt = 0;

    Object.keys(monthEntries).sort().forEach(dateKey => {
      const entry = monthEntries[dateKey];
      const status = entry.attendance ? entry.attendance[member.id] : null;
      const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
      const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);

      if (status === 'full') {
        fullDays++;
        totalAmt += dayAmt;
      } else if (status === 'half') {
        halfDays++;
        totalAmt += halfAmt;
      }
    });

    const totalDays = fullDays + (halfDays * 0.5);

    return `
      <div class="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-xs font-bold uppercase tracking-wider text-slate-400">${monthName}</span>
            <div class="flex space-x-1.5">
              <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">${fullDays} Full</span>
              <span class="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">${halfDays} Half</span>
            </div>
          </div>

          <h3 class="text-lg font-bold text-slate-900">${escapeHTML(member.name)}</h3>
          <p class="text-xs text-slate-500 mt-0.5">${member.phone ? escapeHTML(member.phone) : 'Member'}</p>

          <div class="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
            <span class="text-xs font-semibold text-slate-500">Total Days: <strong class="text-indigo-700">${totalDays} days</strong></span>
            <span class="text-2xl font-black text-emerald-600">
              <span class="currency-symbol">${curr}</span>${formatNumber(totalAmt)}
            </span>
          </div>
        </div>

        <div class="mt-5 pt-3 border-t border-slate-100 flex items-center space-x-2">
          <button onclick="viewMemberMonthlySlip('${member.id}', '${targetMonth}')" class="flex-grow py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition flex items-center justify-center shadow-sm">
            <i data-lucide="receipt" class="w-3.5 h-3.5 mr-1.5"></i>
            View & Print Slip
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Generate printable attendance slip for one member
function viewMemberMonthlySlip(memberId, monthStr) {
  const member = appState.members.find(m => m.id === memberId);
  if (!member) return;

  const targetMonth = monthStr || currentMonth;
  const monthEntries = getEntriesForMonth(targetMonth);

  const [yearStr, monthNumStr] = targetMonth.split('-');
  const monthDate = new Date(parseInt(yearStr), parseInt(monthNumStr) - 1, 1);
  const monthName = monthDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  let fullDays = 0;
  let halfDays = 0;
  let totalAmt = 0;
  const presentRows = [];
  const curr = appState.settings.currency || '₹';

  Object.keys(monthEntries).sort().forEach(dateKey => {
    const entry = monthEntries[dateKey];
    const status = entry.attendance ? entry.attendance[member.id] : null;
    const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
    const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);

    if (status === 'full') {
      fullDays++;
      totalAmt += dayAmt;
      presentRows.push(`
        <tr class="border-b border-slate-100 text-xs">
          <td class="py-1.5 text-slate-700 font-medium">${formatFriendlyDate(dateKey)}</td>
          <td class="py-1.5 text-center text-emerald-700 font-bold">Full Day (1)</td>
          <td class="py-1.5 text-right font-extrabold text-emerald-600">${curr}${dayAmt}</td>
        </tr>
      `);
    } else if (status === 'half') {
      halfDays++;
      totalAmt += halfAmt;
      presentRows.push(`
        <tr class="border-b border-slate-100 text-xs">
          <td class="py-1.5 text-slate-700 font-medium">${formatFriendlyDate(dateKey)}</td>
          <td class="py-1.5 text-center text-amber-700 font-bold">Half Day (½)</td>
          <td class="py-1.5 text-right font-extrabold text-amber-600">${curr}${halfAmt}</td>
        </tr>
      `);
    }
  });

  const totalDays = fullDays + (halfDays * 0.5);

  const slipArea = document.getElementById('attendanceSlipPrintArea');
  slipArea.innerHTML = `
    <div class="print-receipt-border border border-slate-200 rounded-2xl p-6 bg-slate-50/50">
      <div class="text-center pb-4 border-b border-dashed border-slate-300">
        <h2 class="text-xl font-black text-slate-900 tracking-tight">MEMBER ATTENDANCE & AMOUNT SLIP</h2>
        <p class="text-xs text-slate-500 font-medium mt-0.5">Monthly Attendance & Amount Statement</p>
      </div>

      <div class="py-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <span class="text-slate-400 block font-semibold uppercase text-[10px]">Member Name</span>
          <span class="font-bold text-slate-900 text-sm">${escapeHTML(member.name)}</span>
          ${member.phone ? `<span class="text-slate-500 block text-[11px]">${escapeHTML(member.phone)}</span>` : ''}
        </div>
        <div class="text-right">
          <span class="text-slate-400 block font-semibold uppercase text-[10px]">Month (Mound)</span>
          <span class="font-bold text-indigo-700 text-sm">${monthName}</span>
          <span class="text-slate-400 block text-[10px]">Printed: ${formatFriendlyDate(formatDateToISO(new Date()))}</span>
        </div>
      </div>

      <div class="my-3 border-t border-b border-slate-200 py-2">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-slate-400 font-bold uppercase text-[10px] border-b border-slate-200">
              <th class="py-1 text-left">Date</th>
              <th class="py-1 text-center">Status</th>
              <th class="py-1 text-right">Amount Added</th>
            </tr>
          </thead>
          <tbody>
            ${presentRows.length > 0 ? presentRows.join('') : '<tr><td colspan="3" class="py-3 text-center text-slate-400">No attendance recorded this month.</td></tr>'}
          </tbody>
        </table>
      </div>

      <div class="pt-2 space-y-1.5 text-xs">
        <div class="flex justify-between font-semibold text-slate-600">
          <span>Full Days Count:</span>
          <span class="text-emerald-700 font-bold">${fullDays} days</span>
        </div>
        <div class="flex justify-between font-semibold text-slate-600">
          <span>Half Days Count:</span>
          <span class="text-amber-700 font-bold">${halfDays} days (½ day)</span>
        </div>
        <div class="flex justify-between font-semibold text-slate-600">
          <span>Total Days Equivalent:</span>
          <span class="text-indigo-700 font-bold">${totalDays} days</span>
        </div>
        <div class="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-200">
          <span>TOTAL AMOUNT ADDED (MOUND):</span>
          <span class="text-emerald-600">${curr}${formatNumber(totalAmt)}</span>
        </div>
      </div>

      <div class="mt-8 pt-6 border-t border-dashed border-slate-300 flex justify-between items-end text-[11px] text-slate-400">
        <div>
          <span>Member Signature</span>
        </div>
        <div class="text-right">
          <span>Authorized Signature</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('attendanceSlipModal').classList.remove('hidden');

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function closeAttendanceSlipModal() {
  document.getElementById('attendanceSlipModal').classList.add('hidden');
}

function printCurrentSlip() {
  window.print();
}

function printAllAttendanceSummary() {
  switchTab('monthly');
  setTimeout(() => {
    window.print();
  }, 300);
}

// ==========================================
// Backup & Export JSON
// ==========================================
function openBackupModal() {
  document.getElementById('backupModal').classList.remove('hidden');
}

function closeBackupModal() {
  document.getElementById('backupModal').classList.add('hidden');
}

function downloadBackupJSON() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(appState, null, 2));
  const link = document.createElement('a');
  link.setAttribute('href', dataStr);
  link.setAttribute('download', `member_count_amount_backup_${formatDateToISO(new Date())}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Backup JSON downloaded successfully');
}

function handleRestoreFile(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const parsed = JSON.parse(event.target.result);
      if (parsed && parsed.members && parsed.dailyEntries) {
        appState = parsed;
        saveData();
        closeBackupModal();
        renderAllViews();
        showToast('Backup restored successfully!');
      } else {
        alert('Invalid backup file format');
      }
    } catch (err) {
      alert('Error parsing JSON backup file');
    }
  };
  reader.readAsText(file);
}

function confirmResetAllData() {
  if (confirm('Are you sure you want to completely reset all member attendance and amount records? This cannot be undone.')) {
    localStorage.removeItem(STORAGE_KEY);
    loadData();
    closeBackupModal();
    renderAllViews();
    showToast('All data reset to initial state');
  }
}

// ==========================================
// Toast Notification
// ==========================================
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toastNotification');
  const toastMsg = document.getElementById('toastMsg');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = msg;
  toast.classList.remove('translate-y-20', 'opacity-0');
  toast.classList.add('translate-y-0', 'opacity-100');

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('translate-y-0', 'opacity-100');
    toast.classList.add('translate-y-20', 'opacity-0');
  }, 2400);
}

// Utility: render all tabs and views
function renderAllViews() {
  updateKPIs();
  loadDayEntry(currentDate);
  renderMonthlyView();
  renderMembersDirectory();
  renderMemberAttendanceSlips();

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Utility: Format numbers with commas
function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-IN');
}

// Utility: Escape HTML
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ==========================================================
// Labour Attendance Messaging Functions (WhatsApp & SMS)
// ==========================================================

function formatPhoneForWhatsApp(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length === 10) {
    clean = '91' + clean; // Default to India +91 if 10-digit mobile
  }
  return clean;
}

function formatPhoneForSMS(phone) {
  if (!phone) return '';
  return String(phone).replace(/[^\d+]/g, '');
}

function generateAttendanceMessage(member, status, dayAmt, halfAmt, curr) {
  const isFull = status === 'full';
  const amt = isFull ? dayAmt : halfAmt;
  const statusLabel = isFull ? 'FULL DAY (1.0 Day)' : 'HALF DAY (0.5 Day)';
  const companyName = (appState && appState.settings && appState.settings.title) || 'Our Company';
  const friendlyDate = formatFriendlyDate(currentDate);

  return `Hello ${member.name},\n\nYour attendance for today (${friendlyDate}) has been recorded:\n✅ Attendance: ${statusLabel}\n💰 Amount Added: ${curr}${formatNumber(amt)}\n🏢 Company: ${companyName}\n\nThank you for your hard work!`;
}

function sendMemberAttendanceMessage(memberId, channel = 'whatsapp') {
  const member = appState.members.find(m => m.id === memberId);
  if (!member) {
    showToast('Member not found');
    return;
  }
  if (!member.phone || !member.phone.trim()) {
    showToast(`No mobile number saved for ${member.name}. Please edit member and add mobile number.`);
    return;
  }

  const entry = getOrCreateCurrentDayEntry();
  const status = (entry.attendance && entry.attendance[memberId]) || 'full';
  const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
  const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);
  const curr = (appState.settings && appState.settings.currency) || '₹';

  const msg = generateAttendanceMessage(member, status, dayAmt, halfAmt, curr);

  if (channel === 'whatsapp') {
    const waPhone = formatPhoneForWhatsApp(member.phone);
    const waUrl = `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');
    showToast(`Opening WhatsApp for ${member.name}...`);
  } else if (channel === 'sms') {
    const smsPhone = formatPhoneForSMS(member.phone);
    const smsUrl = `sms:${smsPhone}?body=${encodeURIComponent(msg)}`;
    window.location.href = smsUrl;
    showToast(`Opening SMS for ${member.name}...`);
  }
}

function openAttendanceMessageModal() {
  const modal = document.getElementById('attendanceMessageModal');
  const listEl = document.getElementById('messageHubMembersList');
  const emptyAlert = document.getElementById('messageHubEmptyAlert');
  if (!modal || !listEl) return;

  const entry = getOrCreateCurrentDayEntry();
  const attendance = entry.attendance || {};
  const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
  const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);
  const curr = (appState.settings && appState.settings.currency) || '₹';

  const activeMembers = appState.members.filter(m => m.active !== false);
  const presentMembers = activeMembers.filter(m => attendance[m.id] === 'full' || attendance[m.id] === 'half');

  if (presentMembers.length === 0) {
    listEl.innerHTML = '';
    if (emptyAlert) emptyAlert.classList.remove('hidden');
    modal.classList.remove('hidden');
    return;
  }

  if (emptyAlert) emptyAlert.classList.add('hidden');

  listEl.innerHTML = presentMembers.map(member => {
    const status = attendance[member.id];
    const isFull = status === 'full';
    const amt = isFull ? dayAmt : halfAmt;
    const badge = isFull
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800">Full Day (+${curr}${formatNumber(amt)})</span>`
      : `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900">Half Day (+${curr}${formatNumber(amt)})</span>`;

    const hasPhone = member.phone && member.phone.trim();

    return `
      <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div>
          <div class="flex items-center space-x-2">
            <h4 class="font-extrabold text-sm text-slate-900">${escapeHTML(member.name)}</h4>
            ${badge}
          </div>
          <p class="text-xs text-slate-500 mt-0.5 flex items-center">
            <span class="${hasPhone ? 'text-slate-700 font-semibold' : 'text-rose-500 font-bold'}">
              📱 ${hasPhone ? escapeHTML(member.phone) : '⚠️ No phone number saved'}
            </span>
          </p>
        </div>

        <div class="flex items-center space-x-2 flex-shrink-0">
          <button onclick="sendMemberAttendanceMessage('${member.id}', 'whatsapp')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center shadow-xs transition ${!hasPhone ? 'opacity-40 cursor-not-allowed' : ''}" ${!hasPhone ? 'disabled' : ''}>
            <i data-lucide="message-circle" class="w-3.5 h-3.5 mr-1.5"></i>
            WhatsApp
          </button>
          <button onclick="sendMemberAttendanceMessage('${member.id}', 'sms')" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center shadow-xs transition ${!hasPhone ? 'opacity-40 cursor-not-allowed' : ''}" ${!hasPhone ? 'disabled' : ''}>
            <i data-lucide="smartphone" class="w-3.5 h-3.5 mr-1.5"></i>
            SMS
          </button>
        </div>
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
  if (window.lucide) window.lucide.createIcons();
}

function closeAttendanceMessageModal() {
  const modal = document.getElementById('attendanceMessageModal');
  if (modal) modal.classList.add('hidden');
}

function copyAllAttendanceMessages() {
  const entry = getOrCreateCurrentDayEntry();
  const attendance = entry.attendance || {};
  const dayAmt = entry.dayAmount !== undefined ? entry.dayAmount : (appState.settings.dayAmount || 100);
  const halfAmt = entry.halfDayAmount !== undefined ? entry.halfDayAmount : (appState.settings.halfDayAmount || 50);
  const curr = (appState.settings && appState.settings.currency) || '₹';
  const friendlyDate = formatFriendlyDate(currentDate);

  const activeMembers = appState.members.filter(m => m.active !== false);
  const presentMembers = activeMembers.filter(m => attendance[m.id] === 'full' || attendance[m.id] === 'half');

  if (presentMembers.length === 0) {
    showToast('No workers present to copy.');
    return;
  }

  let text = `📋 DAILY ATTENDANCE & AMOUNT SUMMARY\nDate: ${friendlyDate}\nCompany: ${(appState.settings && appState.settings.title) || 'Our Company'}\nTotal Present: ${presentMembers.length}\n----------------------------------------\n`;

  presentMembers.forEach((m, idx) => {
    const status = attendance[m.id];
    const isFull = status === 'full';
    const amt = isFull ? dayAmt : halfAmt;
    text += `${idx + 1}. ${m.name} (${m.phone || 'No phone'}): ${isFull ? 'FULL DAY' : 'HALF DAY'} - ${curr}${formatNumber(amt)}\n`;
  });

  text += `----------------------------------------\nTotal Day Amount: ${curr}${formatNumber(entry.totalDayAmount || 0)}`;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied attendance summary to clipboard!');
    }).catch(() => {
      prompt('Copy attendance summary:', text);
    });
  } else {
    prompt('Copy attendance summary:', text);
  }
}


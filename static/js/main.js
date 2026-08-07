const API = '/api';

function getCookie(name) {
  const v = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
  return v ? v.pop() : '';
}

async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  if (!res.ok) throw await res.json();
  return res.status === 204 ? null : res.json();
}

async function init() {
  await api('/auth/csrf/');
  try {
    const me = await api('/auth/me/');
    renderApp(me.role);
  } catch {
    renderLogin();
  }
}
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <form id="loginForm">
      <h2 id="formTitle">Login</h2>
      <input id="username" placeholder="Username" required>
      <div id="signupFields" style="display:none">
        <input id="firstName" placeholder="First Name">
        <input id="lastName" placeholder="Last Name">
        <input id="email" type="email" placeholder="Email">
        <input id="phone" placeholder="Phone">
      </div>
      <input id="password" type="password" placeholder="Password" required>
      <button type="submit" id="submitBtn">Log In</button>
      <p id="loginError" style="color:red"></p>
      <p style="text-align:center">
        <a href="#" id="toggleMode">Don't have an account? Sign up</a>
      </p>
    </form>`;

  let isSignup = false;
  document.getElementById('toggleMode').onclick = (e) => {
    e.preventDefault();
    isSignup = !isSignup;
    document.getElementById('formTitle').textContent = isSignup ? 'Sign Up' : 'Login';
    document.getElementById('submitBtn').textContent = isSignup ? 'Create Account' : 'Log In';
    document.getElementById('signupFields').style.display = isSignup ? 'block' : 'none';
    document.getElementById('toggleMode').textContent = isSignup
      ? 'Already have an account? Log in'
      : "Don't have an account? Sign up";
  };

  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('loginError');
    try {
      let user;
      if (isSignup) {
        user = await api('/auth/register/', 'POST', {
          username: document.getElementById('username').value,
          password: document.getElementById('password').value,
          first_name: document.getElementById('firstName').value,
          last_name: document.getElementById('lastName').value,
          email: document.getElementById('email').value,
          phone: document.getElementById('phone').value
        });
      } else {
        user = await api('/auth/login/', 'POST', {
          username: document.getElementById('username').value,
          password: document.getElementById('password').value
        });
      }
      renderApp(user.role);
    } catch (err) {
      errEl.textContent = err.detail || JSON.stringify(err) || 'Something went wrong';
    }
  };
}
function renderApp(role) {
  document.getElementById('app').innerHTML = `<div id="content"></div><button id="logout">Logout</button>`;
  document.getElementById('logout').onclick = async () => { await api('/auth/logout/', 'POST'); renderLogin(); };
  if (role === 'sports_mentor') renderMentorDashboard();
  else renderStudentView();
}

async function renderStudentView() {
  const data = await api('/status/today/');
  const rec = data.attendance;
  document.getElementById('content').innerHTML = `
    <h2>Today: ${data.session.date}</h2>
    <p>Status: <b>${rec ? rec.status.toUpperCase() : 'NOT CHECKED IN'}</b></p>
    <button id="historyBtn" style="width:auto;padding:8px 16px">View My History</button>
    <div id="historyList"></div>
    ${!rec ? `
      <button id="scanBtn">Scan QR to Check In</button>
      <div id="reader" style="width:300px"></div>
      <p id="checkinMsg"></p>` : ''}`;

      document.getElementById('historyBtn').onclick = async () => {
    const hist = await api('/history/');
    const html = hist.history.map(h => `
      <tr><td>${h.date}</td><td>${h.status}</td><td>${h.note || ''}</td></tr>`).join('');
    document.getElementById('historyList').innerHTML = `
      <table border="1"><thead><tr><th>Date</th><th>Status</th><th>Note</th></tr></thead>
      <tbody>${html}</tbody></table>`;
  };

  const scanBtn = document.getElementById('scanBtn');
  if (scanBtn) scanBtn.onclick = () => {

    scanBtn.style.display = 'none';
    const qr = new Html5Qrcode("reader");
    qr.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 200 },
      async (decodedText) => {
        await qr.stop();
        document.getElementById('reader').innerHTML = '';
        try {
          const res = await api('/checkin/', 'POST', { qr_token: decodedText });
          document.getElementById('checkinMsg').textContent = res.message;
          renderStudentView();
        } catch (err) {
          document.getElementById('checkinMsg').textContent = err.error || 'Error';
        }
      },
      () => {} 
    );
  };
}
async function renderMentorDashboard() {
  const data = await api('/mentor/dashboard/');
  const qr = await api('/session/qr/');
  const c = data.counters;
  document.getElementById('content').innerHTML = `
    <h2>Mentor Dashboard – ${data.session.date}</h2>
    <p>Total: ${data.total} | Present: ${c.present} | Late: ${c.late} | Absent: ${c.absent} | Not marked: ${c.not_marked}</p>
    <div style="display:flex;gap:10px;align-items:center;margin:12px 0">
      <label>Start: <input type="time" id="startTime" value="${data.session.start_time.slice(0,5)}"></label>
      <label>Late until: <input type="time" id="lateTime" value="${data.session.late_until.slice(0,5)}"></label>
      <button id="saveTimeBtn" style="width:auto;padding:8px 16px">Save Time</button>
    </div>
    <p id="timeMsg" style="color:green"></p>
    <div id="qrDisplay"></div>
    <button id="historyBtn" style="width:auto;padding:8px 16px;margin-bottom:8px">View Past Sessions</button>
    <div id="pastSessions"></div>
    <input id="search" placeholder="Search student...">
    <table border="1" id="table"><thead><tr><th>Student</th><th>Status</th><th>Note</th><th>Action</th></tr></thead><tbody></tbody></table>`;
  const tbody = document.querySelector('#table tbody');

  function renderRows(filter = '') {
    tbody.innerHTML = '';
    data.students
      .filter(s => s.full_name.toLowerCase().includes(filter.toLowerCase()))
      .forEach(s => {
        const color = { present: 'green', late: 'orange', absent: 'red', not_marked: 'gray' }[s.status];
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${s.full_name}</td>
          <td style="color:${color}">${s.status}</td>
          <td>${s.note || ''}</td>
          <td>
            <select data-id="${s.student_id}">
              <option value="present" ${s.status === 'present' ? 'selected' : ''}>Present</option>
              <option value="late" ${s.status === 'late' ? 'selected' : ''}>Late</option>
              <option value="absent" ${s.status === 'absent' ? 'selected' : ''}>Absent</option>
            </select>
          </td>`;
        tr.querySelector('select').onchange = async (e) => {
          await api(`/mentor/student/${s.student_id}/status/`, 'PATCH', { status: e.target.value });
        };
        tbody.appendChild(tr);
      });
  }
  renderRows();
  document.getElementById('saveTimeBtn').onclick = async () => {
    try {
      await api('/mentor/session/time/', 'PATCH', {
        start_time: document.getElementById('startTime').value + ':00',
        late_until: document.getElementById('lateTime').value + ':00'
      });
      document.getElementById('timeMsg').textContent = 'Saved!';
      setTimeout(() => document.getElementById('timeMsg').textContent = '', 2000);
    } catch (err) {
      document.getElementById('timeMsg').textContent = 'Error saving time';
    }
  };
  new QRCode(document.getElementById('qrDisplay'), qr.qr_token);
  document.getElementById('historyBtn').onclick = async () => {
    const data2 = await api('/mentor/sessions/');
    const rows = data2.sessions.map(s => `
      <tr style="cursor:pointer" data-date="${s.date}">
        <td>${s.date}</td><td>${s.is_closed ? 'Closed' : 'Open'}</td>
        <td>${s.present}</td><td>${s.late}</td><td>${s.absent}</td>
      </tr>`).join('');
    const container = document.getElementById('pastSessions');
    container.innerHTML = `
      <table border="1"><thead><tr><th>Date</th><th>Status</th><th>Present</th><th>Late</th><th>Absent</th></tr></thead>
      <tbody>${rows}</tbody></table><div id="sessionDetail"></div>`;
    container.querySelectorAll('tr[data-date]').forEach(tr => {
      tr.onclick = async () => {
        const detail = await api(`/mentor/sessions/${tr.dataset.date}/`);
        const detailRows = detail.students.map(s => `
          <tr><td>${s.full_name}</td><td>${s.status}</td></tr>`).join('');
        document.getElementById('sessionDetail').innerHTML = `
          <h3>${detail.date}</h3>
          <table border="1"><thead><tr><th>Student</th><th>Status</th></tr></thead><tbody>${detailRows}</tbody></table>`;
      };
    });
  };
  document.getElementById('search').oninput = (e) => renderRows(e.target.value);
}

init();
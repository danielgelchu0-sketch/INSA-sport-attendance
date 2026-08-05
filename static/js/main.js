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
      <h2>Login</h2>
      <input id="username" placeholder="Username" required>
      <input id="password" type="password" placeholder="Password" required>
      <button type="submit">Log In</button>
      <p id="loginError" style="color:red"></p>
    </form>`;
  document.getElementById('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    try {
      const user = await api('/auth/login/', 'POST', {
        username: document.getElementById('username').value,
        password: document.getElementById('password').value
      });
      renderApp(user.role);
    } catch (err) {
      document.getElementById('loginError').textContent = err.detail || 'Login failed';
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
    ${!rec ? `
      <button id="scanBtn">Scan QR to Check In</button>
      <div id="reader" style="width:300px"></div>
      <p id="checkinMsg"></p>` : ''}`;

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
      () => {} // ignore per-frame scan failures
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
    <div id="qrDisplay"></div>
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
  new QRCode(document.getElementById('qrDisplay'), qr.qr_token);
  document.getElementById('search').oninput = (e) => renderRows(e.target.value);
}

init();
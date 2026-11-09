const $ = (selector) => document.querySelector(selector);
const state = { token: sessionStorage.getItem('rata-token'), email: sessionStorage.getItem('rata-email'), view: 'schedule', page: 1, data: [], patients: [], doctors: [], pageInfo: null, busy: false };
let loadSequence = 0;
let formSequence = 0;
const config = {
  schedule: { title: 'Appointments', description: 'A clear view of your clinic’s schedule.', singular: 'appointment', list: 'All appointments', caption: 'Your upcoming and past consultations', columns: ['Date & time', 'Patient', 'Doctor', 'Reason', 'Status', ''] },
  patients: { title: 'Patients', description: 'Keep your patient directory up to date.', singular: 'patient', list: 'Patient directory', caption: 'People receiving care at your clinic', columns: ['Name', 'Email address', 'Added', ''] },
  doctors: { title: 'Doctors', description: 'Manage the doctors in your clinic.', singular: 'doctor', list: 'Doctor directory', caption: 'Your clinic’s care team', columns: ['Name', 'Added', ''] },
};
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const dateTime = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const dateOnly = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
async function gql(service, query, variables = {}) {
  let response;
  let result;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    response = await fetch(`/${service}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) }, body: JSON.stringify({ query, variables }), signal: controller.signal });
    result = await response.json();
  } catch (error) {
    if (controller.signal.aborted) throw new Error('The service took too long to respond. Please try again.');
    throw new Error('Could not reach the service or read its response. Check that the local stack is running.');
  } finally { clearTimeout(timeout); }
  if (result.errors?.length) {
    const error = result.errors[0];
    if (error.extensions?.code === 'UNAUTHORIZED' && service === 'schedule-api') { signOut(); throw new Error('Your session expired. Please sign in again.'); }
    const messages = { SCHEDULE_CONFLICT: 'This doctor already has an appointment at that time.', CUSTOMER_HAS_SCHEDULES: 'This patient has appointments and cannot be removed.', DOCTOR_HAS_SCHEDULES: 'This doctor has appointments and cannot be removed.', INVALID_CREDENTIALS: 'Email or password is incorrect.' };
    throw new Error(messages[error.extensions?.code] || error.message || 'Something went wrong.');
  }
  if (!response.ok) throw new Error('The service could not complete your request.');
  return result.data;
}
function notice(message, failure = false) { const el = $('#notice'); el.textContent = message; el.classList.toggle('failure', failure); el.hidden = false; }
function closeProfile() { $('#profile-menu').hidden = true; $('#profile-toggle').setAttribute('aria-expanded', 'false'); }
function signOut() { closeProfile(); loadSequence++; state.token = null; state.email = null; sessionStorage.removeItem('rata-token'); sessionStorage.removeItem('rata-email'); $('#app').hidden = true; $('#login').hidden = false; $('#auth-panel').hidden = false; $('#login-form input[name=email]').focus(); }
function enter() { $('#login').hidden = true; $('#auth-panel').hidden = true; $('#app').hidden = false; $('#user-email').textContent = state.email || 'Clinic staff'; $('#profile-email').textContent = state.email || 'Clinic staff'; $('#avatar').textContent = (state.email || 'C')[0].toUpperCase(); switchView('schedule'); }
$('#login-form').addEventListener('submit', async (event) => { event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button'); const input = Object.fromEntries(new FormData(form)); $('#login-error').textContent = ''; button.disabled = true; button.firstChild.textContent = 'Signing in…'; try { const { login } = await gql('auth-api', 'mutation($input: LoginInput!) { login(input: $input) { accessToken user { email } } }', { input }); state.token = login.accessToken; state.email = login.user.email; sessionStorage.setItem('rata-token', state.token); sessionStorage.setItem('rata-email', state.email); form.reset(); enter(); } catch (error) { $('#login-error').textContent = error.message; } finally { button.disabled = false; button.firstChild.textContent = 'Sign in '; } });
$('#logout').addEventListener('click', signOut);
$('#profile-toggle').addEventListener('click', () => { const open = $('#profile-menu').hidden; $('#profile-menu').hidden = !open; $('#profile-toggle').setAttribute('aria-expanded', String(open)); });
document.addEventListener('click', event => { if (!event.target.closest('.user')) closeProfile(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('#profile-menu').hidden) { closeProfile(); $('#profile-toggle').focus(); } });
document.querySelector('.user').addEventListener('focusout', event => { if (!event.currentTarget.contains(event.relatedTarget)) closeProfile(); });
function switchView(view) { state.view = view; state.page = 1; $('#notice').hidden = true; $('#form-dialog').close(); const c = config[view]; $('#breadcrumb').textContent = c.title; $('#list-title').textContent = c.list; $('#list-caption').textContent = c.caption; $('#add-button').textContent = `＋  New ${c.singular}`; document.querySelectorAll('.nav').forEach(el => el.classList.toggle('active', el.dataset.view === view)); load(); }
document.querySelectorAll('.nav').forEach(el => el.addEventListener('click', () => switchView(el.dataset.view)));
async function load() { const view = state.view; const sequence = ++loadSequence; $('#loading').hidden = false; $('#empty').hidden = true; $('#table-body').innerHTML = ''; $('#count').textContent = ''; $('#page-label').textContent = ''; $('#prev').disabled = true; $('#next').disabled = true; $('#table-head').innerHTML = `<tr>${config[view].columns.map(x => `<th>${x}</th>`).join('')}</tr>`; try { const queries = { schedule: '{ schedules(pagination: {page: PAGE, limit: 10}) { items { id objective scheduledAt customer { name email } doctor { name } } pageInfo { page total totalPages hasNextPage hasPreviousPage } } }', patients: '{ customers(pagination: {page: PAGE, limit: 10}) { items { id name email createdAt } pageInfo { page total totalPages hasNextPage hasPreviousPage } } }', doctors: '{ doctors(pagination: {page: PAGE, limit: 10}) { items { id name createdAt } pageInfo { page total totalPages hasNextPage hasPreviousPage } } }' }; const result = await gql('schedule-api', queries[view].replace('PAGE', state.page)); if (sequence !== loadSequence) return; const data = result[{ schedule: 'schedules', patients: 'customers', doctors: 'doctors' }[view]]; state.data = data.items; state.pageInfo = data.pageInfo; render(); } catch (error) { if (sequence === loadSequence) notice(error.message, true); } finally { if (sequence === loadSequence) $('#loading').hidden = true; } }
function render() { const c = config[state.view]; $('#table-body').innerHTML = state.data.map(item => { if (state.view === 'schedule') return `<tr><td>${escapeHtml(dateTime(item.scheduledAt))}</td><td>${escapeHtml(item.customer.name)}<span class="sub">${escapeHtml(item.customer.email)}</span></td><td>${escapeHtml(item.doctor.name)}</td><td>${escapeHtml(item.objective)}</td><td><span class="status">Scheduled</span></td><td><button class="danger" data-delete="${escapeHtml(item.id)}">Cancel</button></td></tr>`; return `<tr><td>${escapeHtml(item.name)}</td>${state.view === 'patients' ? `<td>${escapeHtml(item.email)}</td>` : ''}<td>${escapeHtml(dateOnly(item.createdAt))}</td><td><button class="danger" data-delete="${escapeHtml(item.id)}">Remove</button></td></tr>`; }).join(''); $('#empty').hidden = state.data.length > 0; $('#empty-title').textContent = `No ${c.title.toLowerCase()} yet`; $('#empty-copy').textContent = `Add your first ${c.singular} to get started.`; $('#count').textContent = `${state.pageInfo.total} total ${c.title.toLowerCase()}`; $('#page-label').textContent = `Page ${state.pageInfo.page} of ${Math.max(1, state.pageInfo.totalPages)}`; $('#prev').disabled = !state.pageInfo.hasPreviousPage; $('#next').disabled = !state.pageInfo.hasNextPage; }
$('#prev').addEventListener('click', () => { state.page--; load(); }); $('#next').addEventListener('click', () => { state.page++; load(); }); $('#refresh').addEventListener('click', () => { if ($('#notice').classList.contains('failure')) $('#notice').hidden = true; load(); });
$('#table-body').addEventListener('click', async event => { const button = event.target.closest('[data-delete]'); if (!button) return; const c = config[state.view]; if (!confirm(`${state.view === 'schedule' ? 'Cancel' : 'Remove'} this ${c.singular}?`)) return; button.disabled = true; try { const op = { schedule: 'deleteSchedule', patients: 'deleteCustomer', doctors: 'deleteDoctor' }[state.view]; await gql('schedule-api', `mutation($id: ID!) { ${op}(id: $id) { id } }`, { id: button.dataset.delete }); notice(`${c.singular[0].toUpperCase() + c.singular.slice(1)} ${state.view === 'schedule' ? 'cancelled' : 'removed'}.`); await load(); } catch (error) { notice(error.message, true); button.disabled = false; } });
async function directoryItems(field, selection) {
  const items = [];
  let page = 1;
  let hasNextPage = true;
  while (hasNextPage) {
    const result = await gql('schedule-api', `query($page: Int!) { ${field}(pagination: {page: $page, limit: 100}) { items { ${selection} } pageInfo { hasNextPage } } }`, { page });
    items.push(...result[field].items);
    hasNextPage = result[field].pageInfo.hasNextPage;
    page++;
  }
  return items;
}
function setupDirectorySearch(kind, items) {
  const search = $(`#${kind}-search`);
  const select = $(`#${kind}-select`);
  const count = $(`#${kind}-matches`);
  const update = () => {
    const previous = select.value;
    const term = search.value.trim().toLocaleLowerCase();
    const matches = items.filter(item => `${item.name} ${item.email || ''}`.toLocaleLowerCase().includes(term));
    select.innerHTML = `<option value="">${matches.length ? `Select ${kind}` : `No matching ${kind}s`}</option>` + matches.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}${item.email ? ` — ${escapeHtml(item.email)}` : ''}</option>`).join('');
    if (matches.some(item => String(item.id) === previous)) select.value = previous;
    count.textContent = `${matches.length} ${kind}${matches.length === 1 ? '' : 's'} available`;
  };
  search.addEventListener('input', update);
  update();
}
async function openForm() {
  const sequence = ++formSequence;
  const view = state.view;
  const c = config[view];
  $('#notice').hidden = true; $('#form-error').textContent = ''; $('#form-title').textContent = `New ${c.singular}`; $('#form-description').textContent = view === 'schedule' ? 'Choose the patient, doctor and consultation time.' : `Add a ${c.singular} to your directory.`; $('#save-button').textContent = `Save ${c.singular}`; $('#form-fields').innerHTML = '<p>Loading…</p>'; $('#form-dialog').showModal();
  $('#save-button').disabled = true;
  try {
    if (view === 'schedule') {
      const [patients, doctors] = await Promise.all([directoryItems('customers', 'id name email'), directoryItems('doctors', 'id name')]);
      if (sequence !== formSequence || state.view !== view || !$('#form-dialog').open) return;
      state.patients = patients; state.doctors = doctors;
      $('#form-fields').innerHTML = `<div class="directory-field"><label for="patient-search">Find patient</label><input id="patient-search" type="search" autocomplete="off" placeholder="Search by name or email" aria-describedby="patient-matches"><span id="patient-matches" class="search-hint" aria-live="polite"></span><label for="patient-select">Patient</label><select id="patient-select" name="customerId" required></select></div><div class="directory-field"><label for="doctor-search">Find doctor</label><input id="doctor-search" type="search" autocomplete="off" placeholder="Search by name" aria-describedby="doctor-matches"><span id="doctor-matches" class="search-hint" aria-live="polite"></span><label for="doctor-select">Doctor</label><select id="doctor-select" name="doctorId" required></select></div><label>Date and time<input name="scheduledAt" type="datetime-local" required></label><label>Reason for visit<input name="objective" maxlength="500" required placeholder="e.g. Consultation"></label>`;
      setupDirectorySearch('patient', patients); setupDirectorySearch('doctor', doctors);
      if (!patients.length || !doctors.length) $('#form-error').textContent = 'Add a patient and a doctor before creating an appointment.';
    } else {
      $('#form-fields').innerHTML = `<label>Full name<input name="name" maxlength="200" required placeholder="Enter full name"></label>${view === 'patients' ? '<label>Email address<input name="email" type="email" maxlength="320" required placeholder="patient@example.com"></label>' : ''}`;
    }
    $('#form-fields input, #form-fields select')?.focus();
    $('#save-button').disabled = false;
  } catch (error) { if (sequence === formSequence && state.view === view && $('#form-dialog').open) $('#form-error').textContent = error.message; }
}
$('#form-dialog').addEventListener('close', () => { formSequence++; });

$('#add-button').addEventListener('click', openForm); $('#close-form').addEventListener('click', () => $('#form-dialog').close()); $('#cancel-form').addEventListener('click', () => $('#form-dialog').close());
$('#entry-form').addEventListener('submit', async event => { event.preventDefault(); const input = Object.fromEntries(new FormData(event.currentTarget)); const view = state.view; const button = $('#save-button'); $('#form-error').textContent = ''; button.disabled = true; try { if (view === 'schedule') input.scheduledAt = new Date(input.scheduledAt).toISOString(); const op = { schedule: ['createSchedule', 'CreateScheduleInput'], patients: ['createCustomer', 'CreateCustomerInput'], doctors: ['createDoctor', 'CreateDoctorInput'] }[view]; await gql('schedule-api', `mutation($input: ${op[1]}!) { ${op[0]}(input: $input) { id } }`, { input }); $('#form-dialog').close(); state.page = 1; notice(`${config[view].singular[0].toUpperCase() + config[view].singular.slice(1)} added${view === 'schedule' ? '. A confirmation email has been queued.' : '.'}`); await load(); } catch (error) { $('#form-error').textContent = error.message; } finally { button.disabled = false; } });
$('#today').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date()).toUpperCase();
if (state.token) enter();

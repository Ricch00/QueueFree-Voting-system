import React, { useState, useEffect, useCallback  } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCandidates, approveCandidate, getLiveMonitoring, getElectionResults, getElectionReport, getAuditLogs, changeAdminPw, createNotification } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, XCircle, Download, Trophy, Activity } from 'lucide-react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);

// ── CANDIDATES ─────────────────────────────────────────────────────────────
export function CandidatesPage() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '' });

const load = useCallback(() => {
  getCandidates(filters)
    .then(r => {
      setCandidates(r.data);
      setLoading(false);
    })
    .catch(() => setLoading(false));
}, [filters]);
useEffect(() => {
  load();
}, [load]);
  const handleApprove = async (id, status) => {
    try { await approveCandidate(id, { status }); toast.success(`Candidate ${status}`); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Candidates</h1><p className="page-subtitle">Manage all election candidates</p></div></div>
      <div className="filter-bar">
        <select className="form-control" style={{ width: 160 }} value={filters.status} onChange={e => setFilters({ status: e.target.value })}>
          <option value="">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="disqualified">Disqualified</option>
        </select>
      </div>
      <div className="card">
        <div className="table-wrapper">
          {loading ? <div className="loading-row"><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
            <table>
              <thead><tr><th>Candidate</th><th>Election</th><th>Position</th><th>Program</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {!candidates.length ? <tr><td colSpan={6}><div className="empty-state"><p>No candidates found</p></div></td></tr>
                  : candidates.map(c => (
                    <tr key={c.id}>
                      <td><div style={{ fontWeight: 500 }}>{c.full_name}</div>{c.nickname && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>"{c.nickname}"</div>}</td>
                      <td style={{ fontSize: 12, color: 'var(--gray-600)', maxWidth: 180 }}>{c.election_title}</td>
                      <td><span className="badge badge-primary">{c.position_title}</span></td>
                      <td>{c.program} · L{c.level}</td>
                      <td><span className={`badge ${c.status === 'approved' ? 'badge-success' : c.status === 'rejected' || c.status === 'disqualified' ? 'badge-danger' : 'badge-warning'}`}>{c.status}</span></td>
                      <td>
                        <div className="action-group">
                          {c.status === 'pending' && <>
                            <button className="btn btn-sm btn-success" onClick={() => handleApprove(c.id, 'approved')}><CheckCircle size={13} /> Approve</button>
                            <button className="btn btn-sm btn-danger"  onClick={() => handleApprove(c.id, 'rejected')}><XCircle size={13} /> Reject</button>
                          </>}
                          {c.status === 'approved' && <button className="btn btn-sm btn-warning" onClick={() => handleApprove(c.id, 'disqualified')}>Disqualify</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── MONITORING ─────────────────────────────────────────────────────────────
export function MonitoringPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const [data, setData] = useState(null);
  const load = useCallback(() => getLiveMonitoring(id).then(r => setData(r.data)).catch(() => {}), [id]);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  if (!data) return <div className="loading-row"><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  const { election, stats, votes_by_hour } = data;
  const chartData = {
    labels: votes_by_hour?.map(v => v.hour?.slice(-5)) || [],
    datasets: [{ label: 'Votes', data: votes_by_hour?.map(v => v.count) || [], fill: true, borderColor: '#1a56db', backgroundColor: 'rgba(26,86,219,.1)', tension: 0.4 }]
  };
  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">{election.title}</h1><p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--gray-500)' }}><span className="live-dot" /> Live Monitoring</p></div>
        </div>
      </div>
      <div className="stats-grid">
        {[['Votes Cast', stats.votes_cast, 'var(--success)'], ['Tokens Issued', stats.tokens_issued, 'var(--primary)'], ['Total Eligible', stats.total_eligible, 'var(--info)'], ['Turnout', `${stats.turnout}%`, 'var(--warning)']].map(([l, v, c]) => (
          <div key={l} className="stat-card"><div className="stat-value" style={{ color: c }}>{v}</div><div className="stat-label">{l}</div></div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 500 }}>Turnout Progress</span>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{stats.votes_cast} / {stats.total_eligible}</span>
        </div>
        <div className="progress" style={{ height: 12 }}><div className="progress-bar progress-bar-success" style={{ width: `${stats.turnout}%` }} /></div>
      </div>
      <div className="card">
        <div className="card-header"><span className="card-title"><Activity size={15} style={{ display: 'inline', marginRight: 6 }} />Voting Activity Over Time</span></div>
        <div className="card-body"><div className="chart-container"><Line data={chartData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }} /></div></div>
      </div>
    </div>
  );
}

// ── RESULTS ────────────────────────────────────────────────────────────────
export function ResultsPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const [data, setData] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { getElectionResults(id).then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false)); }, [id]);

  const downloadReport = async () => {
    try {
      const r = await getElectionReport(id);
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob); const a = document.createElement('a');
      a.href = url; a.download = `election_results_${id}.json`; a.click();
    } catch { toast.error('Failed to download'); }
  };

  if (loading) return <div className="loading-row"><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!data) return <div className="alert alert-danger">Failed to load results</div>;
  const { results, stats } = data;

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)}><ArrowLeft size={18} /></button>
          <div><h1 className="page-title">Election Results</h1><p className="page-subtitle">Turnout: {stats?.turnout}% · {stats?.votes_cast} votes cast</p></div>
        </div>
        <button className="btn btn-outline" onClick={downloadReport}><Download size={15} /> Export Report</button>
      </div>
      {results?.map(({ position, candidates, total_votes }) => (
        <div key={position.id} className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><span className="card-title">{position.title}</span><span className="badge badge-gray">{total_votes} total votes</span></div>
          <div className="card-body">
            {candidates.map((c, i) => (
              <div key={c.id} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {i === 0 && <Trophy size={16} color="var(--warning)" />}
                    <div>
                      <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{c.full_name}</span>
                      {c.nickname && <span style={{ fontSize: 12, color: 'var(--gray-500)', marginLeft: 6 }}>"{c.nickname}"</span>}
                    </div>
                    {i === 0 && total_votes > 0 && <span className="badge badge-warning">Winner</span>}
                  </div>
                  <div style={{ fontWeight: 600 }}>{c.vote_count} <span style={{ color: 'var(--gray-500)', fontSize: 12 }}>({c.percentage}%)</span></div>
                </div>
                <div className="progress"><div className="progress-bar" style={{ width: `${c.percentage}%`, background: i === 0 ? 'var(--success)' : 'var(--primary)' }} /></div>
              </div>
            ))}
            {!candidates.length && <p style={{ color: 'var(--gray-400)', fontSize: 13 }}>No candidates</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── AUDIT LOGS ─────────────────────────────────────────────────────────────
export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ page: 1, limit: 50 });
  const [pagination, setPagination] = useState({});

  const load = useCallback(() => {
    setLoading(true);

    getAuditLogs(filters)
      .then(r => {
        setLogs(r.data || []);
        setPagination(r.pagination || {});
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

  }, [filters]);


  useEffect(() => {
    load();
  }, [load]);


  const ACTION_COLOR = {
    LOGIN: 'badge-success',
    LOGIN_FAILED: 'badge-danger',
    CAST_VOTE: 'badge-primary',
    REGISTER: 'badge-info'
  };


  return (
    <div>

      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">
            Immutable record of all system actions
          </p>
        </div>
      </div>


      <div className="card">

        <div className="table-wrapper">

          {loading ? (

            <div className="loading-row">
              <div 
                className="spinner" 
                style={{margin:'0 auto'}} 
              />
            </div>

          ) : (

            <table>

              <thead>
                <tr>
                  <th>Time</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP</th>
                </tr>
              </thead>


              <tbody>

              {!logs.length ? (

                <tr>
                  <td colSpan={5}>
                    <div className="empty-state">
                      <p>No audit logs yet</p>
                    </div>
                  </td>
                </tr>

              ) : (

                logs.map(log => (

                  <tr key={log.id}>

                    <td>
                      {new Date(log.created_at)
                      .toLocaleString()}
                    </td>


                    <td>
                      {log.actor_email || "System"}
                    </td>


                    <td>
                      <span className={`badge ${
                        ACTION_COLOR[log.action] || 
                        'badge-gray'
                      }`}>
                        {log.action.replace(/_/g,' ')}
                      </span>
                    </td>


                    <td>
                      {
                        log.resource_type 
                        ? `${log.resource_type} #${log.resource_id}`
                        : '-'
                      }
                    </td>


                    <td>
                      {log.ip_address || '-'}
                    </td>


                  </tr>

                ))

              )}

              </tbody>

            </table>

          )}

        </div>


        {pagination.pages > 1 && (

          <div className="pagination">

            <button
              disabled={filters.page === 1}
              onClick={() =>
                setFilters(prev => ({
                  ...prev,
                  page: prev.page - 1
                }))
              }
            >
              ← Prev
            </button>


            <span>
              Page {filters.page} of {pagination.pages}
            </span>


            <button
              disabled={
                filters.page === pagination.pages
              }
              onClick={() =>
                setFilters(prev => ({
                  ...prev,
                  page: prev.page + 1
                }))
              }
            >
              Next →
            </button>

          </div>

        )}

      </div>

    </div>
  );
}

// ── SETTINGS ───────────────────────────────────────────────────────────────
export function SettingsPage() {
  const { admin } = useAuth();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault();
    if (form.new_password !== form.confirm_password) return toast.error('Passwords do not match');
    if (form.new_password.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try { await changeAdminPw({ current_password: form.current_password, new_password: form.new_password }); toast.success('Password changed'); setForm({ current_password: '', new_password: '', confirm_password: '' }); }
    catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };
  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Settings</h1><p className="page-subtitle">Manage your account</p></div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header"><span className="card-title">Account Information</span></div>
          <div className="card-body">
            {[['Full Name', admin?.name], ['Email', admin?.email], ['Role', admin?.role?.replace(/_/g, ' ')]].map(([l, v]) => (
              <div key={l} className="form-group"><label className="form-label">{l}</label><input className="form-control" value={v || ''} disabled /></div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Change Password</span></div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              {[['Current Password', 'current_password'], ['New Password', 'new_password'], ['Confirm New Password', 'confirm_password']].map(([l, k]) => (
                <div key={k} className="form-group"><label className="form-label">{l}</label><input type="password" className="form-control" required value={form[k]} onChange={e => setForm(p => ({ ...p, [k]: e.target.value }))} /></div>
              ))}
              <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Changing…' : 'Change Password'}</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────
export function NotificationsPage() {
  const [form, setForm] = useState({ title: '', message: '', type: 'system', target: 'all' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true);
    try { await createNotification(form); toast.success('Notification sent to students!'); setForm({ title: '', message: '', type: 'system', target: 'all' }); }
    catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };
  return (
    <div>
      <div className="page-header"><div><h1 className="page-title">Notifications</h1><p className="page-subtitle">Send announcements to students</p></div></div>
      <div className="card" style={{ maxWidth: 600 }}>
        <div className="card-header"><span className="card-title">Send Notification</span></div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group"><label className="form-label">Title *</label><input className="form-control" placeholder="e.g. Election Now Open!" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Message *</label><textarea className="form-control" rows={4} placeholder="Write your announcement…" required value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Type</label>
                <select className="form-control" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="system">System</option><option value="election_open">Election Open</option><option value="election_close">Election Close</option><option value="results">Results</option><option value="verification">Verification</option>
                </select>
              </div>
              <div className="form-group"><label className="form-label">Send To</label>
                <select className="form-control" value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))}>
                  <option value="all">All Students</option><option value="verified">Verified Students Only</option>
                </select>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Sending…' : '📢 Send Notification'}</button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CandidatesPage;

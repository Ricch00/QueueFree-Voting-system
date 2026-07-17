// StudentsPage
import React, { useState, useEffect, useCallback } from 'react';
import { getStudents, getStudentStats, verifyStudent, toggleStudent, bulkVerify } from '../../services/api';
import toast from 'react-hot-toast';
import { Search, CheckCircle, XCircle, RefreshCw, User } from 'lucide-react';

export default function StudentsPage() {
  const [students, setStudents] = useState([]);
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', status: '', level: '', page: 1 });
  const [pagination, setPagination] = useState({});
  const [selected, setSelected] = useState([]);
  const [viewStudent, setViewStudent] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, stRes] = await Promise.all([getStudents(filters), getStudentStats()]);
      setStudents(sRes.data); setPagination(sRes.pagination); setStats(stRes.data);
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);

  const handleVerify = async (id, status, note) => {
    try { await verifyStudent(id, { status, note }); toast.success(`Student ${status}`); load(); }
    catch (err) { toast.error(err.message); }
  };
  const handleToggle = async id => {
    try { await toggleStudent(id); toast.success('Updated'); load(); }
    catch (err) { toast.error(err.message); }
  };
  const handleBulk = async status => {
    if (!selected.length) return toast.error('No students selected');
    if (!window.confirm(`${status} ${selected.length} students?`)) return;
    try { await bulkVerify({ student_ids: selected, status }); toast.success('Done'); setSelected([]); load(); }
    catch (err) { toast.error(err.message); }
  };
  const toggleSelect = id => setSelected(p => p.includes(id) ? p.filter(s => s !== id) : [...p, id]);
  const toggleAll   = () => setSelected(selected.length === students.length ? [] : students.map(s => s.id));
  const sf = k => e => setFilters(p => ({ ...p, [k]: e.target.value, page: 1 }));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Students</h1><p className="page-subtitle">Verify and manage student accounts</p></div>
        <button className="btn btn-outline" onClick={load}><RefreshCw size={15} /> Refresh</button>
      </div>

      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 20 }}>
          {[['Total', stats.total, 'var(--gray-700)'], ['Verified', stats.verified, 'var(--success)'], ['Pending', stats.pending, 'var(--warning)'], ['Rejected', stats.rejected, 'var(--danger)'], ['Device Reg.', stats.device_registered, 'var(--primary)']].map(([l, v, c]) => (
            <div key={l} className="card" style={{ padding: '14px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: c }}>{v || 0}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>{l}</div>
            </div>
          ))}
        </div>
      )}

      <div className="filter-bar">
        <div className="search-wrap" style={{ flex: 1 }}>
          <Search size={16} />
          <input className="form-control" placeholder="Search name, student ID, email…" value={filters.search} onChange={sf('search')} />
        </div>
        <select className="form-control" style={{ width: 160 }} value={filters.status} onChange={sf('status')}>
          <option value="">All Statuses</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option>
        </select>
        <select className="form-control" style={{ width: 130 }} value={filters.level} onChange={sf('level')}>
          <option value="">All Levels</option>{['100','200','300','400','500','600','postgrad'].map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {selected.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'var(--primary-light)', borderRadius: 8, marginBottom: 12 }}>
          <span style={{ fontWeight: 500, color: 'var(--primary)', fontSize: 13 }}>{selected.length} selected</span>
          <button className="btn btn-sm btn-success" onClick={() => handleBulk('verified')}><CheckCircle size={13} /> Verify All</button>
          <button className="btn btn-sm btn-danger"  onClick={() => handleBulk('rejected')}><XCircle size={13} /> Reject All</button>
          <button className="btn btn-sm btn-ghost"   onClick={() => setSelected([])}>Clear</button>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper">
          {loading ? <div className="loading-row"><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
            <table>
              <thead><tr>
                <th><input type="checkbox" checked={selected.length === students.length && students.length > 0} onChange={toggleAll} /></th>
                <th>Student</th><th>Student ID</th><th>Program / Level</th><th>Photos</th><th>Status</th><th>Registered</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {!students.length ? <tr><td colSpan={8}><div className="empty-state"><p>No students found</p></div></td></tr>
                  : students.map(s => (
                    <tr key={s.id}>
                      <td><input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: s.verification_status === 'verified' ? 'var(--success-light)' : 'var(--gray-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: s.verification_status === 'verified' ? 'var(--success)' : 'var(--gray-500)' }}>
                            {s.full_name?.charAt(0)}
                          </div>
                          <div><div style={{ fontWeight: 500 }}>{s.full_name}</div><div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{s.email}</div></div>
                        </div>
                      </td>
                      <td><code style={{ fontSize: 12, background: 'var(--gray-100)', padding: '2px 6px', borderRadius: 4 }}>{s.student_id}</code></td>
                      <td><div>{s.program}</div><div style={{ fontSize: 11, color: 'var(--gray-500)' }}>Level {s.level}</div></td>
                      <td>
                        {s.id_photo_url && s.selfie_url ? (
                          <span className="badge badge-success">✓ Photos Uploaded</span>
                        ) : s.id_photo_url || s.selfie_url ? (
                          <span className="badge badge-warning">Partial</span>
                        ) : (
                          <span className="badge badge-gray">No Photos</span>
                        )}
                      </td>
                      <td><span className={`badge ${s.verification_status === 'verified' ? 'badge-success' : s.verification_status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{s.verification_status}</span></td>
                      <td style={{ fontSize: 12, color: 'var(--gray-500)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                      <td>
                        <div className="action-group">
                          <button className="btn btn-sm btn-ghost" onClick={() => setViewStudent(s)}><User size={13} /></button>
                          {s.verification_status === 'pending' && <>
                            <button className="btn btn-sm btn-success" onClick={() => handleVerify(s.id, 'verified')}><CheckCircle size={13} /></button>
                            <button className="btn btn-sm btn-danger"  onClick={() => handleVerify(s.id, 'rejected')}><XCircle size={13} /></button>
                          </>}
                          {s.verification_status === 'verified' && <button className="btn btn-sm btn-warning" onClick={() => handleVerify(s.id, 'rejected')}>Revoke</button>}
                          <button className="btn btn-sm btn-ghost" style={{ color: s.is_active ? 'var(--danger)' : 'var(--success)', fontSize: 11 }} onClick={() => handleToggle(s.id)}>{s.is_active ? 'Disable' : 'Enable'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
        {pagination.pages > 1 && (
          <div className="pagination">
            <button disabled={filters.page === 1} onClick={() => setFilters(p => ({ ...p, page: p.page - 1 }))}>← Prev</button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(pg => (
              <button key={pg} className={filters.page === pg ? 'active' : ''} onClick={() => setFilters(p => ({ ...p, page: pg }))}>{pg}</button>
            ))}
            <button disabled={filters.page === pagination.pages} onClick={() => setFilters(p => ({ ...p, page: p.page + 1 }))}>Next →</button>
          </div>
        )}
      </div>

      {viewStudent && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setViewStudent(null)}>
          <div className="modal modal-lg">
            <div className="modal-header"><h3 className="modal-title">Student Details</h3><button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewStudent(null)}>✕</button></div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 20 }}>
                <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--primary)', flexShrink: 0 }}>{viewStudent.full_name?.charAt(0)}</div>
                <div><h3 style={{ fontSize: 18, fontWeight: 700 }}>{viewStudent.full_name}</h3><p style={{ color: 'var(--gray-500)', fontSize: 13 }}>{viewStudent.email}</p><div style={{ marginTop: 8 }}><span className={`badge ${viewStudent.verification_status === 'verified' ? 'badge-success' : viewStudent.verification_status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>{viewStudent.verification_status}</span></div></div>
              </div>
              <div className="form-row">
                {[['Student ID', viewStudent.student_id], ['Program', viewStudent.program], ['Level', viewStudent.level], ['Department', viewStudent.department], ['Faculty', viewStudent.faculty], ['Hall', viewStudent.hall || 'N/A'], ['Phone', viewStudent.phone || 'N/A']].map(([l, v]) => (
                  <div key={l}><div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 2 }}>{l}</div><div style={{ fontWeight: 500 }}>{v}</div></div>
                ))}
              </div>
              <hr className="divider" />
              <div><div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 4 }}>DEVICE FINGERPRINT</div>
                <code style={{ fontSize: 12, background: 'var(--gray-100)', padding: '4px 8px', borderRadius: 4, display: 'block', wordBreak: 'break-all' }}>{viewStudent.device_fingerprint || 'Not registered'}</code></div>
              {viewStudent.id_photo_url && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 6 }}>Student ID Photo</div>
                  <img src={viewStudent.id_photo_url} alt="Student ID" style={{ width: '100%', maxHeight: 320, borderRadius: 12, objectFit: 'contain', border: '1px solid var(--gray-200)' }} />
                </div>
              )}
              {viewStudent.selfie_url && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 6 }}>Submitted Selfie</div>
                  <img src={viewStudent.selfie_url} alt="Student Selfie" style={{ width: '100%', maxHeight: 320, borderRadius: 12, objectFit: 'contain', border: '1px solid var(--gray-200)' }} />
                </div>
              )}
              {viewStudent.verification_note && (
                <div style={{ marginTop: 18 }}>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 600, marginBottom: 6 }}>Verification Note</div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--gray-700)' }}>{viewStudent.verification_note}</div>
                </div>
              )}
              {viewStudent.verified_by_name && (
                <div style={{ marginTop: 18, display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--gray-600)' }}>
                  <strong>Reviewed by:</strong> {viewStudent.verified_by_name}
                </div>
              )}
              {viewStudent.verification_status === 'pending' && (
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="btn btn-success" style={{ flex: 1 }} onClick={() => { handleVerify(viewStudent.id, 'verified'); setViewStudent(null); }}><CheckCircle size={15} /> Verify Student</button>
                  <button className="btn btn-danger"  style={{ flex: 1 }} onClick={() => { handleVerify(viewStudent.id, 'rejected'); setViewStudent(null); }}><XCircle size={15} /> Reject</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

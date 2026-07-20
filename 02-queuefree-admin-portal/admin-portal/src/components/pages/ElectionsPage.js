import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getElections, createElection, updateElectionStatus, deleteElection } from '../../services/api';
import toast from 'react-hot-toast';
import { Plus, Eye, Trash2, Play, Square, CheckCircle, BarChart3, Activity } from 'lucide-react';

const STATUS_BADGE = { draft: 'badge-gray', published: 'badge-primary', active: 'badge-success', closed: 'badge-warning', results_published: 'badge-info' };

export default function ElectionsPage() {
  const [elections, setElections] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const load = () => getElections().then(r => { setElections(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const handleStatus = async (id, status) => {
    const labels = { published: 'publish', active: 'activate', closed: 'close', results_published: 'publish results' };
    if (!window.confirm(`${labels[status]} this election?`)) return;
    try { await updateElectionStatus(id, status); toast.success('Status updated'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const handleDelete = async id => {
    if (!window.confirm('Delete this election? This cannot be undone.')) return;
    try { await deleteElection(id); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Elections</h1><p className="page-subtitle">Create and manage student elections</p></div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New Election</button>
      </div>
      <div className="card">
        <div className="table-wrapper">
          {loading ? <div className="loading-row"><div className="spinner" style={{ margin: '0 auto' }} /></div> : (
            <table>
              <thead><tr><th>Title</th><th>Year / Semester</th><th>Status</th><th>Dates</th><th>Positions</th><th>Candidates</th><th>Votes</th><th>Actions</th></tr></thead>
              <tbody>
                {!elections.length
                  ? <tr><td colSpan={8}><div className="empty-state"><h3>No elections yet</h3><p>Create your first election to get started</p></div></td></tr>
                  : elections.map(e => (
                    <tr key={e.id}>
                      <td><div style={{ fontWeight: 600 }}>{e.title}</div></td>
                      <td>{e.academic_year} · {e.semester}</td>
                      <td><span className={`badge ${STATUS_BADGE[e.status] || 'badge-gray'}`}>{e.status.replace(/_/g, ' ')}</span></td>
                      <td style={{ fontSize: 12 }}>
                        <div>Start: {new Date(e.start_date).toLocaleDateString()}</div>
                        <div>End: {new Date(e.end_date).toLocaleDateString()}</div>
                      </td>
                      <td><span className="badge badge-gray">{e.position_count}</span></td>
                      <td><span className="badge badge-gray">{e.candidate_count}</span></td>
                      <td><strong>{e.vote_count}</strong></td>
                      <td>
                        <div className="action-group">
                          <button className="btn btn-sm btn-outline" onClick={() => navigate(`/elections/${e.id}`)} title="View"><Eye size={13} /></button>
                          {e.status === 'draft'    && <button className="btn btn-sm btn-primary"  onClick={() => handleStatus(e.id, 'published')}><Play size={13} /> Publish</button>}
                          {e.status === 'published' && <button className="btn btn-sm btn-success" onClick={() => handleStatus(e.id, 'active')}><Play size={13} /> Activate</button>}
                          {e.status === 'active'   && <>
                            <button className="btn btn-sm btn-outline"  onClick={() => navigate(`/monitoring/${e.id}`)}><Activity size={13} /></button>
                            <button className="btn btn-sm btn-warning"  onClick={() => handleStatus(e.id, 'closed')}><Square size={13} /> Close</button>
                          </>}
                          {e.status === 'closed'   && <button className="btn btn-sm btn-success" onClick={() => handleStatus(e.id, 'results_published')}><CheckCircle size={13} /> Publish Results</button>}
                          {e.status === 'results_published' && <button className="btn btn-sm btn-outline" onClick={() => navigate(`/results/${e.id}`)}><BarChart3 size={13} /></button>}
                          {['draft', 'published'].includes(e.status) && <button className="btn btn-sm btn-danger" onClick={() => handleDelete(e.id)}><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {showModal && <CreateElectionModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); load(); }} />}
    </div>
  );
}

function CreateElectionModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ 
    title: '', description: '', academic_year: '2024/2025', semester: 'first', 
    start_date: '', end_date: '', allow_all_students: true,
    eligible_halls: [], eligible_departments: [], eligible_faculties: [], 
    eligible_programs: [], eligible_levels: []
  });
  const [loading, setLoading] = useState(false);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const handleMultiSelect = (field, value) => {
    setForm(p => ({
      ...p,
      [field]: p[field].includes(value) 
        ? p[field].filter(v => v !== value) 
        : [...p[field], value]
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (new Date(form.end_date) <= new Date(form.start_date)) return toast.error('End date must be after start date');
    setLoading(true);
    try { 
      await createElection(form); 
      toast.success('Election created'); 
      onCreated(); 
    }
    catch (err) { toast.error(err.message || 'Failed'); } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h3 className="modal-title">Create New Election</h3><button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Election Title *</label><input className="form-control" placeholder="e.g. SRC General Elections 2024/2025" required value={form.title} onChange={f('title')} /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} placeholder="Brief description..." value={form.description} onChange={f('description')} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Academic Year *</label><input className="form-control" required value={form.academic_year} onChange={f('academic_year')} /></div>
              <div className="form-group"><label className="form-label">Semester</label>
                <select className="form-control" value={form.semester} onChange={f('semester')}>
                  <option value="first">First Semester</option><option value="second">Second Semester</option><option value="summer">Summer</option>
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Start Date & Time *</label><input type="datetime-local" className="form-control" required value={form.start_date} onChange={f('start_date')} /></div>
              <div className="form-group"><label className="form-label">End Date & Time *</label><input type="datetime-local" className="form-control" required value={form.end_date} onChange={f('end_date')} /></div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>
              <input type="checkbox" checked={form.allow_all_students} onChange={e => setForm(p => ({ ...p, allow_all_students: e.target.checked }))} />
              Allow all verified students to vote
            </label>
            
            {!form.allow_all_students && (
              <div style={{ padding: 16, background: 'var(--gray-50)', borderRadius: 8, border: '1px solid var(--gray-200)' }}>
                <div style={{ fontWeight: 600, marginBottom: 12, fontSize: 14 }}>Eligibility Criteria</div>
                
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Eligible Levels</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {['100','200','300','400','500','600','postgrad'].map(level => (
                      <label key={level} style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', 
                        borderRadius: 6, fontSize: 12, cursor: 'pointer',
                        background: form.eligible_levels.includes(level) ? 'var(--primary-light)' : 'var(--gray-100)',
                        color: form.eligible_levels.includes(level) ? 'var(--primary)' : 'var(--gray-700)'
                      }}>
                        <input type="checkbox" checked={form.eligible_levels.includes(level)} onChange={() => handleMultiSelect('eligible_levels', level)} style={{ display: 'none' }} />
                        {level}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Eligible Halls</label>
                  <input 
                    className="form-control" 
                    placeholder="Enter halls separated by commas (e.g. Commonwealth, Legon, Mensah Sarbah)"
                    value={form.eligible_halls.join(', ')}
                    onChange={e => setForm(p => ({ ...p, eligible_halls: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Eligible Departments</label>
                  <input 
                    className="form-control" 
                    placeholder="Enter departments separated by commas (e.g. Computer Science, Information Technology)"
                    value={form.eligible_departments.join(', ')}
                    onChange={e => setForm(p => ({ ...p, eligible_departments: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label" style={{ fontSize: 12 }}>Eligible Faculties</label>
                  <input 
                    className="form-control" 
                    placeholder="Enter faculties separated by commas (e.g. Science, Engineering, Business)"
                    value={form.eligible_faculties.join(', ')}
                    onChange={e => setForm(p => ({ ...p, eligible_faculties: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontSize: 12 }}>Eligible Programs</label>
                  <input 
                    className="form-control" 
                    placeholder="Enter programs separated by commas (e.g. BSc Computer Science, BSc Information Technology)"
                    value={form.eligible_programs.join(', ')}
                    onChange={e => setForm(p => ({ ...p, eligible_programs: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Creating…' : 'Create Election'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getElection, createPosition, deletePosition, addCandidate, getCandidates, approveCandidate, deleteCandidate, getStudents, updateElectionStatus } from '../../services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle, UserPlus } from 'lucide-react';

export default function ElectionDetailPage() {
  const { id } = useParams(); const navigate = useNavigate();
  const [election, setElection] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('positions');
  const [showPos, setShowPos] = useState(false);
  const [showCand, setShowCand] = useState(false);

  const load = React.useCallback(async () => {
    try {
      const [eRes, cRes] = await Promise.all([getElection(id), getCandidates({ election_id: id })]);
      setElection(eRes.data); setCandidates(cRes.data);
    } catch { toast.error('Failed to load'); } finally { setLoading(false); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const handleApprove = async (cId, status) => {
    try { await approveCandidate(cId, { status }); toast.success(`Candidate ${status}`); load(); }
    catch (err) { toast.error(err.message); }
  };

  const handleDeleteCandidate = async cId => {
    if (!window.confirm('Remove candidate?')) return;
    try { await deleteCandidate(cId); toast.success('Removed'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const handleDeletePosition = async posId => {
    if (!window.confirm('Delete position and all its candidates?')) return;
    try { await deletePosition(id, posId); toast.success('Deleted'); load(); }
    catch (err) { toast.error(err.message); }
  };

  const changeStatus = async status => {
    if (!window.confirm(`Set election to "${status}"?`)) return;
    try { await updateElectionStatus(id, status); toast.success('Status updated'); load(); }
    catch (err) { toast.error(err.message); }
  };

  if (loading) return <div className="loading-row"><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!election) return <div className="alert alert-danger">Election not found</div>;

  const byPos = (election.positions || []).reduce((acc, p) => { acc[p.id] = candidates.filter(c => c.position_id === p.id); return acc; }, {});

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="btn btn-ghost btn-icon" onClick={() => navigate('/elections')}><ArrowLeft size={18} /></button>
          <div>
            <h1 className="page-title">{election.title}</h1>
            <p className="page-subtitle">{election.academic_year} · {election.semester} semester · <span className={`badge ${election.status === 'active' ? 'badge-success' : 'badge-gray'}`}>{election.status}</span></p>
          </div>
        </div>
        <div className="page-actions">
          {election.status === 'draft'     && <button className="btn btn-primary" onClick={() => changeStatus('published')}>Publish</button>}
          {election.status === 'published' && <button className="btn btn-success" onClick={() => changeStatus('active')}>Activate</button>}
          {election.status === 'active'    && <button className="btn btn-warning" onClick={() => changeStatus('closed')}>Close Election</button>}
          {election.status === 'closed'    && <button className="btn btn-success" onClick={() => changeStatus('results_published')}>Publish Results</button>}
        </div>
      </div>

      {/* Info bar */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
            {[['Start', new Date(election.start_date).toLocaleString()], ['End', new Date(election.end_date).toLocaleString()], ['Positions', election.positions?.length || 0], ['Approved Candidates', candidates.filter(c => c.status === 'approved').length]].map(([l, v]) => (
              <div key={l}><div style={{ fontSize: 11, color: 'var(--gray-500)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>{l}</div><div style={{ fontWeight: 600 }}>{v}</div></div>
            ))}
          </div>
          {election.description && <p style={{ marginTop: 12, color: 'var(--gray-600)', fontSize: 13 }}>{election.description}</p>}
        </div>
      </div>

      <div className="tabs">
        {['positions', 'all_candidates'].map(t => (
          <div key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'positions' ? `Positions & Candidates` : `All Candidates (${candidates.length})`}
          </div>
        ))}
      </div>

      {tab === 'positions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 16 }}>
            {['draft', 'published'].includes(election.status) && <button className="btn btn-outline" onClick={() => setShowPos(true)}><Plus size={15} /> Add Position</button>}
            {(election.positions?.length || 0) > 0 && <button className="btn btn-primary" onClick={() => setShowCand(true)}><UserPlus size={15} /> Add Candidate</button>}
          </div>
          {!(election.positions?.length) ? (
            <div className="empty-state card" style={{ padding: 40 }}>
              <h3>No Positions Yet</h3><p>Add positions like President, Secretary to this election</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowPos(true)}><Plus size={15} /> Add First Position</button>
            </div>
          ) : election.positions.map(pos => (
            <div key={pos.id} className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <div><span className="card-title">{pos.title}</span>{pos.description && <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>{pos.description}</p>}</div>
                <div className="action-group">
                  <span className="badge badge-gray">{byPos[pos.id]?.length || 0} candidates</span>
                  {['draft', 'published'].includes(election.status) && <button className="btn btn-sm btn-danger" onClick={() => handleDeletePosition(pos.id)}><Trash2 size={13} /></button>}
                </div>
              </div>
              {!(byPos[pos.id]?.length) ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--gray-400)', fontSize: 13 }}>No candidates yet</div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead><tr><th>Candidate</th><th>Student ID</th><th>Program</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {byPos[pos.id].map(c => (
                        <tr key={c.id}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              {c.photo_url && <img src={c.photo_url} alt={c.full_name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                              <div>
                                <div style={{ fontWeight: 500 }}>{c.nickname || c.full_name}</div>
                                {c.nickname && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{c.full_name}</div>}
                              </div>
                            </div>
                          </td>
                          <td>{c.student_number}</td>
                          <td>{c.program} · L{c.level}</td>
                          <td><span className={`badge ${c.status === 'approved' ? 'badge-success' : c.status === 'rejected' ? 'badge-danger' : 'badge-warning'}`}>{c.status}</span></td>
                          <td>
                            <div className="action-group">
                              {c.status === 'pending' && <>
                                <button className="btn btn-sm btn-success" onClick={() => handleApprove(c.id, 'approved')}><CheckCircle size={13} /></button>
                                <button className="btn btn-sm btn-danger"  onClick={() => handleApprove(c.id, 'rejected')}><XCircle size={13} /></button>
                              </>}
                              {c.status === 'approved' && <button className="btn btn-sm btn-warning" onClick={() => handleApprove(c.id, 'disqualified')}>Disqualify</button>}
                              <button className="btn btn-sm btn-ghost" onClick={() => handleDeleteCandidate(c.id)}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'all_candidates' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Name</th><th>Position</th><th>Student ID</th><th>Program</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {!candidates.length ? <tr><td colSpan={6}><div className="empty-state"><p>No candidates yet</p></div></td></tr>
                  : candidates.map(c => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {c.photo_url && <img src={c.photo_url} alt={c.full_name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover' }} />}
                          <div>
                            <div style={{ fontWeight: 500 }}>{c.full_name}</div>
                            {c.nickname && <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>"{c.nickname}"</div>}
                          </div>
                        </div>
                      </td>
                      <td><span className="badge badge-primary">{c.position_title}</span></td>
                      <td>{c.student_number}</td>
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
          </div>
        </div>
      )}

      {showPos  && <PositionModal  electionId={id} onClose={() => setShowPos(false)}  onCreated={() => { setShowPos(false);  load(); }} />}
      {showCand && <CandidateModal electionId={id} positions={election.positions || []} onClose={() => setShowCand(false)} onCreated={() => { setShowCand(false); load(); }} />}
    </div>
  );
}

function PositionModal({ electionId, onClose, onCreated }) {
  const [form, setForm] = useState({ title: '', description: '' });
  const [loading, setLoading] = useState(false);
  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true);
    try { await createPosition(electionId, form); toast.success('Position added'); onCreated(); }
    catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h3 className="modal-title">Add Position</h3><button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group"><label className="form-label">Title *</label><input className="form-control" placeholder="e.g. President, Secretary General" required value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Adding…' : 'Add Position'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CandidateModal({ electionId, positions, onClose, onCreated }) {
  const [form, setForm] = useState({ election_id: electionId, position_id: '', student_id: '', manifesto: '', nickname: '', photo: '' });
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);

  useEffect(() => {
    if (search.length >= 2) getStudents({ search, status: 'verified', limit: 10 }).then(r => setStudents(r.data)).catch(() => {});
    else setStudents([]);
  }, [search]);

  const handlePhotoChange = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setForm(p => ({ ...p, photo: reader.result }));
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async e => {
    e.preventDefault();
    if (!form.student_id) return toast.error('Please select a student');
    setLoading(true);
    try { await addCandidate(form); toast.success('Candidate added'); onCreated(); }
    catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header"><h3 className="modal-title">Add Candidate</h3><button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button></div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Position *</label>
              <select className="form-control" required value={form.position_id} onChange={e => setForm(p => ({ ...p, position_id: e.target.value }))}>
                <option value="">Select position…</option>
                {positions.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Search Student (verified only) *</label>
              <input className="form-control" placeholder="Type name or student ID…" value={search} onChange={e => setSearch(e.target.value)} />
              {students.length > 0 && (
                <div style={{ border: '1px solid var(--gray-200)', borderRadius: 6, marginTop: 4, maxHeight: 180, overflowY: 'auto' }}>
                  {students.map(s => (
                    <div key={s.id} onClick={() => { setForm(p => ({ ...p, student_id: s.id })); setSearch(`${s.full_name} (${s.student_id})`); setStudents([]); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', background: Number(form.student_id) === s.id ? 'var(--primary-light)' : 'white', borderBottom: '1px solid var(--gray-100)' }}>
                      <span style={{ fontWeight: 500 }}>{s.full_name}</span> · {s.student_id} · {s.program} L{s.level}
                    </div>
                  ))}
                </div>
              )}
              {form.student_id && <div className="form-hint" style={{ color: 'var(--success)' }}>✓ Student selected</div>}
            </div>
            <div className="form-group"><label className="form-label">Nickname / Campaign Name</label><input className="form-control" placeholder="Optional" value={form.nickname} onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))} /></div>
            <div className="form-group"><label className="form-label">Candidate Photo</label>
              <input type="file" accept="image/*" onChange={handlePhotoChange} className="form-control" />
              {photoPreview && <img src={photoPreview} alt="Preview" style={{ marginTop: 10, maxWidth: 200, maxHeight: 200, borderRadius: 8, objectFit: 'cover' }} />}
            </div>
            <div className="form-group"><label className="form-label">Manifesto</label><textarea className="form-control" rows={3} placeholder="Campaign message…" value={form.manifesto} onChange={e => setForm(p => ({ ...p, manifesto: e.target.value }))} /></div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !form.student_id}>{loading ? 'Adding…' : 'Add Candidate'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

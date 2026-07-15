import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboard } from '../../services/api';
import { Users, Vote, CheckCircle, Clock, Activity, BarChart3, TrendingUp } from 'lucide-react';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { formatDistanceToNow } from 'date-fns';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend);

export default function DashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = () => getDashboard().then(r => { setData(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  if (loading) return <div className="loading-row"><div className="spinner" style={{ margin: '0 auto' }} /></div>;
  if (!data) return <div className="alert alert-danger">Failed to load dashboard</div>;

  const { students, elections, votes, recent_activity, active_elections, turnout_chart } = data;

  const turnoutData = {
    labels: turnout_chart?.map(e => e.title.substring(0, 18) + (e.title.length > 18 ? '…' : '')) || [],
    datasets: [{ label: 'Votes', data: turnout_chart?.map(e => e.votes) || [], backgroundColor: '#1a56db', borderRadius: 6 }]
  };
  const studentDonut = {
    labels: ['Verified', 'Pending', 'Rejected'],
    datasets: [{ data: [students.verified || 0, students.pending || 0, students.rejected || 0], backgroundColor: ['#0e9f6e', '#d97706', '#e02424'], borderWidth: 0 }]
  };

  const statCards = [
    { label: 'Total Students',       value: students.total,    sub: `${students.verified || 0} verified`,  icon: Users,        color: '#1a56db', bg: '#e8f0fe' },
    { label: 'Elections',            value: elections.total,   sub: `${elections.active || 0} active`,     icon: Vote,         color: '#0891b2', bg: '#e0f2fe' },
    { label: 'Votes Cast',           value: votes,             sub: 'All elections',                       icon: CheckCircle,  color: '#0e9f6e', bg: '#def7ec' },
    { label: 'Pending Verification', value: students.pending || 0, sub: 'Awaiting approval',              icon: Clock,        color: '#d97706', bg: '#fef3c7' },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Overview of the QueueFree E-Voting System</p>
        </div>
        {(elections.active || 0) > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--success-light)', color: 'var(--success)', padding: '8px 16px', borderRadius: 8, fontWeight: 600, fontSize: 13 }}>
            <span className="live-dot" /> {elections.active} Election{elections.active > 1 ? 's' : ''} Live
          </div>
        )}
      </div>

      <div className="stats-grid">
        {statCards.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="stat-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <div className="stat-value">{Number(s.value || 0).toLocaleString()}</div>
                  <div className="stat-label">{s.label}</div>
                </div>
                <div className="stat-icon" style={{ background: s.bg }}><Icon size={22} color={s.color} /></div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 500 }}>{s.sub}</div>
            </div>
          );
        })}
      </div>

      {active_elections?.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="live-dot" /><span className="card-title">Active Elections</span>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {active_elections.map(e => {
              const turnout = e.tokens_issued > 0 ? Math.min((e.votes_cast / e.tokens_issued) * 100, 100) : 0;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{e.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 8 }}>Ends: {new Date(e.end_date).toLocaleString()} · {e.votes_cast} votes cast</div>
                    <div className="progress" style={{ width: 280 }}><div className="progress-bar progress-bar-success" style={{ width: `${turnout}%` }} /></div>
                    <div style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>{turnout.toFixed(1)}% turnout</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => navigate(`/monitoring/${e.id}`)}><Activity size={14} /> Monitor</button>
                    <button className="btn btn-sm btn-outline" onClick={() => navigate(`/results/${e.id}`)}><BarChart3 size={14} /> Results</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="card">
          <div className="card-header"><span className="card-title"><TrendingUp size={15} style={{ display: 'inline', marginRight: 6 }} />Voter Turnout by Election</span></div>
          <div className="card-body">
            {turnout_chart?.length ? (
              <div className="chart-container">
                <Bar data={turnoutData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }} />
              </div>
            ) : <div className="empty-state"><p>No election data yet</p></div>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><span className="card-title">Student Status</span></div>
          <div className="card-body">
            <div className="chart-container" style={{ height: 200 }}>
              <Doughnut data={studentDonut} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, cutout: '65%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 12 }}>
              {[['Verified', students.verified || 0, 'var(--success)'], ['Pending', students.pending || 0, 'var(--warning)'], ['Rejected', students.rejected || 0, 'var(--danger)']].map(([l, v, c]) => (
                <div key={l} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
                  <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">Recent Activity</span></div>
        <div className="card-body" style={{ padding: 0 }}>
          {recent_activity?.length ? recent_activity.map((log, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: log.actor_type === 'admin' ? 'var(--primary)' : 'var(--success)', flexShrink: 0 }} />
              <div style={{ flex: 1, fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{log.actor_email || 'System'}</span>
                <span style={{ color: 'var(--gray-500)', margin: '0 4px' }}>·</span>
                <span style={{ color: 'var(--gray-600)' }}>{log.action.replace(/_/g, ' ').toLowerCase()}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-400)', whiteSpace: 'nowrap' }}>
                {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
              </div>
            </div>
          )) : <div className="empty-state"><p>No activity yet</p></div>}
        </div>
      </div>
    </div>
  );
}

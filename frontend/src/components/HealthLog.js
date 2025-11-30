import React, { useEffect, useState } from 'react';
import axios from 'axios';

const formatDate = (iso) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return '';
  }
};

const Card = ({ item }) => {
  const t = item.type;
  return (
    <div className="log-card">
      <div className="log-card-header">
        <span className="log-type">{t}</span>
        {item.created_at && <span className="log-date">{formatDate(item.created_at)}</span>}
      </div>
      <div className="log-card-body">
        {t === 'blood_pressure' && (
          <div className="log-row">
            <span>SYS</span><strong>{item.value_1 ?? '-'}</strong>
            <span>DIA</span><strong>{item.value_2 ?? '-'}</strong>
            <span>PULSE</span><strong>{item.value_3 ?? '-'}</strong>
          </div>
        )}
        {t === 'spo2' && (
          <div className="log-row"><span>SpO2</span><strong>{item.value_1 ?? '-'}</strong></div>
        )}
        {t === 'weight' && (
          <div className="log-row"><span>Weight</span><strong>{item.value_1 ?? '-'}</strong></div>
        )}
        {t === 'steps' && (
          <div className="log-row"><span>Steps</span><strong>{item.value_1 ?? '-'}</strong></div>
        )}
        {t === 'medication' && (
          <div className="log-row"><span>Taken</span><strong>{item.value_bool ? 'Yes' : 'No'}</strong></div>
        )}
        {t === 'symptoms' && (
          <div className="log-row"><span>Notes</span><strong>{item.value_text ?? '-'}</strong></div>
        )}
      </div>
    </div>
  );
};

const HealthLog = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const API_BASE = process.env.REACT_APP_BACKEND_URL;
        const res = await axios.get(`${API_BASE}/api/health-events`);
        setItems(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setError('Failed to load health events');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  if (loading) return <div className="loader">Loading...</div>;
  if (error) return <div className="error-container"><p className="error">{error}</p></div>;

  return (
    <div className="health-log-container">
      {items.length === 0 ? (
        <p>No records found.</p>
      ) : (
        items.map((it) => <Card key={it.id || `${it.type}-${it.created_at}`} item={it} />)
      )}
    </div>
  );
};

export default HealthLog;
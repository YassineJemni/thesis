// src/components/Dependencies/DependencyManager.jsx
import React, { useState, useEffect } from 'react';
import './DependencyManager.css';

function DependencyManager({ projectId, tasks, onDependencyCreated }) {
  const [showModal, setShowModal] = useState(false);
  const [predecessorId, setPredecessorId] = useState('');
  const [successorId, setSuccessorId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateDependency = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Validation
    if (predecessorId === successorId) {
      setError('A task cannot depend on itself');
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/tasks/dependencies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          predecessor_task_id: parseInt(predecessorId),
          successor_task_id: parseInt(successorId)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create dependency');
      }

      // Success
      alert('✅ Dependency created successfully!');
      setPredecessorId('');
      setSuccessorId('');
      setShowModal(false);
      
      // Callback to refresh parent component
      if (onDependencyCreated) {
        onDependencyCreated();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setShowModal(true)} 
        className="btn-dependency"
        disabled={tasks.length < 2}
        title={tasks.length < 2 ? "Need at least 2 tasks to create dependencies" : "Create task dependency"}
      >
        🔗 Add Dependency
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Task Dependency</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">
                ×
              </button>
            </div>

            <div className="dependency-explanation">
              <p>
                <strong>📌 How dependencies work:</strong><br/>
                The <strong>predecessor task</strong> must be completed <strong>before</strong> the <strong>successor task</strong> can start.
              </p>
              <p style={{marginTop: '0.5rem', fontSize: '14px', color: '#666'}}>
                Example: If "Design Mockups" must finish before "Frontend Development" starts,<br/>
                then Design Mockups = Predecessor, Frontend Development = Successor
              </p>
            </div>

            <form onSubmit={handleCreateDependency}>
              {error && (
                <div className="error-message" style={{marginBottom: '1rem'}}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label>
                  <strong>1️⃣ Predecessor Task (must finish first)</strong>
                </label>
                <select
                  value={predecessorId}
                  onChange={(e) => setPredecessorId(e.target.value)}
                  required
                >
                  <option value="">-- Select predecessor task --</option>
                  {tasks.map(task => (
                    <option key={task.id} value={task.id}>
                      {task.name} (ID: {task.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="dependency-arrow">
                ⬇️ THEN ⬇️
              </div>

              <div className="form-group">
                <label>
                  <strong>2️⃣ Successor Task (starts after predecessor)</strong>
                </label>
                <select
                  value={successorId}
                  onChange={(e) => setSuccessorId(e.target.value)}
                  required
                >
                  <option value="">-- Select successor task --</option>
                  {tasks.map(task => (
                    <option 
                      key={task.id} 
                      value={task.id}
                      disabled={task.id === parseInt(predecessorId)}
                    >
                      {task.name} (ID: {task.id})
                    </option>
                  ))}
                </select>
              </div>

              {predecessorId && successorId && (
                <div className="dependency-preview">
                  <strong>📋 Preview:</strong>
                  <div className="preview-content">
                    <span className="task-name">
                      {tasks.find(t => t.id === parseInt(predecessorId))?.name}
                    </span>
                    <span className="arrow">→</span>
                    <span className="task-name">
                      {tasks.find(t => t.id === parseInt(successorId))?.name}
                    </span>
                  </div>
                </div>
              )}

              <div className="modal-footer">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)} 
                  className="btn-secondary"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={loading || !predecessorId || !successorId}
                >
                  {loading ? 'Creating...' : 'Create Dependency'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default DependencyManager;
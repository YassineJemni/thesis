// src/components/Resources/Resources.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { resourceAPI } from '../../services/api';
import './Resources.css';

function Resources() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewResource, setShowNewResource] = useState(false);
  const [newResource, setNewResource] = useState({
    name: '',
    skills: '',
    available: true
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      const response = await resourceAPI.getAll();
      setResources(response.data);
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    try {
      const resourceData = {
        ...newResource,
        skills: newResource.skills.split(',').map(s => s.trim()).filter(s => s)
      };
      await resourceAPI.create(resourceData);
      setNewResource({ name: '', skills: '', available: true });
      setShowNewResource(false);
      fetchResources();
    } catch (error) {
      console.error('Error creating resource:', error);
    }
  };

  const handleToggleAvailability = async (id, currentAvailable) => {
    try {
      await resourceAPI.updateAvailability(id, !currentAvailable);
      fetchResources();
    } catch (error) {
      console.error('Error updating availability:', error);
    }
  };

  if (loading) {
    return (
      <div className="resources-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="resources-page">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>Resource Allocation System</h2>
        </div>
        <div className="nav-links">
          <button onClick={() => navigate('/dashboard')} className="nav-btn">
            Dashboard
          </button>
          <button onClick={() => {
            localStorage.removeItem('token');
            navigate('/login');
          }} className="nav-btn-logout">
            Logout
          </button>
        </div>
      </nav>

      <div className="resources-content">
        <div className="resources-header">
          <h1>Resources</h1>
          <button onClick={() => setShowNewResource(true)} className="btn-primary">
            + New Resource
          </button>
        </div>

        {resources.length === 0 ? (
          <div className="empty-state">
            <p>No resources yet. Add your first resource to get started!</p>
          </div>
        ) : (
          <div className="resources-grid">
            {resources.map((resource) => (
              <div key={resource.id} className="resource-card">
                <div className="resource-header">
                  <h3>{resource.name}</h3>
                  <button
                    onClick={() => handleToggleAvailability(resource.id, resource.available)}
                    className={`availability-toggle ${resource.available ? 'available' : 'unavailable'}`}
                  >
                    {resource.available ? '✓ Available' : '✗ Unavailable'}
                  </button>
                </div>
                
                {resource.skills && resource.skills.length > 0 && (
                  <div className="resource-skills">
                    <strong>Skills:</strong>
                    <div className="skills-tags">
                      {resource.skills.map((skill, index) => (
                        <span key={index} className="skill-tag">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="resource-footer">
                  <span className="resource-id">ID: {resource.id}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Resource Modal */}
      {showNewResource && (
        <div className="modal-overlay" onClick={() => setShowNewResource(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Resource</h2>
              <button onClick={() => setShowNewResource(false)} className="close-btn">
                ×
              </button>
            </div>
            <form onSubmit={handleCreateResource}>
              <div className="form-group">
                <label>Resource Name</label>
                <input
                  type="text"
                  value={newResource.name}
                  onChange={(e) => setNewResource({...newResource, name: e.target.value})}
                  placeholder="Enter resource name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Skills (comma-separated)</label>
                <input
                  type="text"
                  value={newResource.skills}
                  onChange={(e) => setNewResource({...newResource, skills: e.target.value})}
                  placeholder="Python, React, Database, etc."
                />
              </div>
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newResource.available}
                    onChange={(e) => setNewResource({...newResource, available: e.target.checked})}
                  />
                  <span>Available</span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowNewResource(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Add Resource
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Resources;
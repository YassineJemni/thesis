// src/components/Resources/Resources.jsx - FIXED
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
    type: 'employee', // FIXED: Added type field (required by backend)
    skills: '',
    cost_per_hour: 0, // FIXED: Added cost_per_hour field
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
      if (error.response?.status === 401) {
        // Token expired, redirect to login
        localStorage.removeItem('token');
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCreateResource = async (e) => {
    e.preventDefault();
    try {
      const resourceData = {
        name: newResource.name,
        type: newResource.type, // FIXED: Include type
        skills: newResource.skills.split(',').map(s => s.trim()).filter(s => s),
        cost_per_hour: parseFloat(newResource.cost_per_hour) || 0 // FIXED: Include cost
      };
      
      console.log('Creating resource:', resourceData); // Debug log
      
      await resourceAPI.create(resourceData);
      
      setNewResource({ 
        name: '', 
        type: 'employee',
        skills: '', 
        cost_per_hour: 0,
        available: true 
      });
      setShowNewResource(false);
      fetchResources();
    } catch (error) {
      console.error('Error creating resource:', error);
      alert('Failed to create resource: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleToggleAvailability = async (id, currentAvailable) => {
    try {
      await resourceAPI.updateAvailability(id, !currentAvailable);
      fetchResources();
    } catch (error) {
      console.error('Error updating availability:', error);
      alert('Failed to update availability');
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
          <h1>Resources ({resources.length})</h1>
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
                
                <div className="resource-type">
                  <strong>Type:</strong> <span style={{textTransform: 'capitalize'}}>{resource.type}</span>
                </div>

                {resource.cost_per_hour > 0 && (
                  <div className="resource-cost">
                    <strong>Cost:</strong> ${resource.cost_per_hour}/hour
                  </div>
                )}
                
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
                <label>Resource Name *</label>
                <input
                  type="text"
                  value={newResource.name}
                  onChange={(e) => setNewResource({...newResource, name: e.target.value})}
                  placeholder="John Developer"
                  required
                />
              </div>

              <div className="form-group">
                <label>Type *</label>
                <select
                  value={newResource.type}
                  onChange={(e) => setNewResource({...newResource, type: e.target.value})}
                  required
                >
                  <option value="employee">Employee</option>
                  <option value="equipment">Equipment</option>
                </select>
              </div>

              <div className="form-group">
                <label>Cost per Hour ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={newResource.cost_per_hour}
                  onChange={(e) => setNewResource({...newResource, cost_per_hour: e.target.value})}
                  placeholder="50.00"
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
                <small style={{color: '#666', fontSize: '12px'}}>
                  These skills will be matched to task requirements
                </small>
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
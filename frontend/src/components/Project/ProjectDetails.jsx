// src/components/Project/ProjectDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectAPI, taskAPI } from '../../services/api';
import './ProjectDetails.css';

function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    duration: 1,
    required_skills: ''
  });

  const fetchProjectData = async () => {
    try {
      const [projectRes, tasksRes] = await Promise.all([
        projectAPI.getById(id),
        taskAPI.getByProject(id)
      ]);
      setProject(projectRes.data);
      setTasks(tasksRes.data);
    } catch (error) {
      console.error('Error fetching project data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const taskData = {
        ...newTask,
        duration: parseInt(newTask.duration),
        required_skills: newTask.required_skills.split(',').map(s => s.trim()).filter(s => s)
      };
      await taskAPI.create(id, taskData);
      setNewTask({ name: '', description: '', duration: 1, required_skills: '' });
      setShowNewTask(false);
      fetchProjectData();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await taskAPI.delete(taskId);
        fetchProjectData();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleAllocateResources = async () => {
    try {
      await projectAPI.allocate(id);
      alert('Resources allocated successfully!');
      fetchProjectData();
    } catch (error) {
      console.error('Error allocating resources:', error);
      alert('Failed to allocate resources');
    }
  };

  if (loading) {
    return (
      <div className="project-details">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="project-details">
        <div className="error">Project not found</div>
      </div>
    );
  }

  return (
    <div className="project-details">
      <nav className="navbar">
        <div className="nav-brand">
          <h2>Resource Allocation System</h2>
        </div>
        <div className="nav-links">
          <button onClick={() => navigate('/dashboard')} className="nav-btn">
            Dashboard
          </button>
          <button onClick={() => navigate('/resources')} className="nav-btn">
            Resources
          </button>
          <button onClick={() => {
            localStorage.removeItem('token');
            navigate('/login');
          }} className="nav-btn-logout">
            Logout
          </button>
        </div>
      </nav>

      <div className="project-content">
        <div className="project-header">
          <div>
            <h1>{project.name}</h1>
            <p className="project-description">{project.description || 'No description'}</p>
          </div>
          <div className="header-actions">
            <button onClick={() => setShowNewTask(true)} className="btn-primary">
              + New Task
            </button>
            <button onClick={handleAllocateResources} className="btn-allocate">
              🎯 Allocate Resources
            </button>
          </div>
        </div>

        <div className="tasks-section">
          <h2>Tasks ({tasks.length})</h2>
          {tasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks yet. Create your first task to get started!</p>
            </div>
          ) : (
            <div className="tasks-list">
              {tasks.map((task) => (
                <div key={task.id} className="task-card">
                  <div className="task-header">
                    <h3>{task.name}</h3>
                    <button 
                      onClick={() => handleDeleteTask(task.id)}
                      className="btn-delete"
                    >
                      🗑️
                    </button>
                  </div>
                  <p className="task-description">{task.description || 'No description'}</p>
                  <div className="task-meta">
                    <span className="task-duration">
                      ⏱️ {task.duration} {task.duration === 1 ? 'day' : 'days'}
                    </span>
                    {task.required_skills && task.required_skills.length > 0 && (
                      <span className="task-skills">
                        🛠️ {task.required_skills.join(', ')}
                      </span>
                    )}
                  </div>
                  {task.assigned_resource_id && (
                    <div className="task-assignment">
                      ✅ Assigned to Resource #{task.assigned_resource_id}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Task Modal */}
      {showNewTask && (
        <div className="modal-overlay" onClick={() => setShowNewTask(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Task</h2>
              <button onClick={() => setShowNewTask(false)} className="close-btn">
                ×
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="form-group">
                <label>Task Name</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({...newTask, name: e.target.value})}
                  placeholder="Enter task name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                  placeholder="Enter task description"
                  rows="3"
                />
              </div>
              <div className="form-group">
                <label>Duration (days)</label>
                <input
                  type="number"
                  min="1"
                  value={newTask.duration}
                  onChange={(e) => setNewTask({...newTask, duration: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Required Skills (comma-separated)</label>
                <input
                  type="text"
                  value={newTask.required_skills}
                  onChange={(e) => setNewTask({...newTask, required_skills: e.target.value})}
                  placeholder="Python, React, Database"
                />
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowNewTask(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetails;
// src/components/Project/ProjectDetails.jsx - WITH DAG VISUALIZATION AND DEPENDENCY MANAGER
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectAPI, taskAPI } from '../../services/api';
import TaskDAG from '../DAG/TaskDAG';
import DependencyManager from '../Dependencies/DependencyManager';
import AutoDependencyGenerator from '../Dependencies/AutoDependencyGenerator';
import './ProjectDetails.css';

function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewTask, setShowNewTask] = useState(false);
  const [dagKey, setDagKey] = useState(0); // Key to force DAG refresh
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    estimated_duration: 240,
    priority: 3,
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
      
      // Fetch schedule/allocations
      try {
        const scheduleRes = await projectAPI.getSchedule(id);
        setAllocations(scheduleRes.data.schedule || []);
      } catch (err) {
        console.log('No schedule yet:', err);
        setAllocations([]);
      }
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
        name: newTask.name,
        description: newTask.description,
        estimated_duration: parseInt(newTask.estimated_duration),
        priority: parseInt(newTask.priority),
        required_skills: newTask.required_skills.split(',').map(s => s.trim()).filter(s => s)
      };
      
      console.log('Sending task data:', taskData);
      
      await taskAPI.create(id, taskData);
      
      // Reset form
      setNewTask({ 
        name: '', 
        description: '', 
        estimated_duration: 240,
        priority: 3,
        required_skills: '' 
      });
      setShowNewTask(false);
      fetchProjectData();
      setDagKey(prev => prev + 1); // Refresh DAG
    } catch (error) {
      console.error('Error creating task:', error);
      alert('Failed to create task: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await taskAPI.delete(taskId);
        fetchProjectData();
        setDagKey(prev => prev + 1); // Refresh DAG
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task');
      }
    }
  };

  const handleAllocateResources = async () => {
    try {
      const result = await projectAPI.allocate(id);
      console.log('Allocation result:', result.data);
      alert(`✅ Resources allocated successfully!\n\n${result.data.length} task(s) assigned.`);
      fetchProjectData(); // Refresh to show allocations
    } catch (error) {
      console.error('Error allocating resources:', error);
      alert('Failed to allocate resources: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDependencyCreated = () => {
    // Refresh DAG and project data after dependency is created
    setDagKey(prev => prev + 1);
    fetchProjectData();
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
            <AutoDependencyGenerator
              projectId={id}
              tasks={tasks}
              onDependenciesGenerated={handleDependencyCreated}
            />
            <DependencyManager 
              projectId={id}
              tasks={tasks}
              onDependencyCreated={handleDependencyCreated}
            />
            <button onClick={handleAllocateResources} className="btn-allocate">
              🎯 Allocate Resources
            </button>
          </div>
        </div>

        <div className="tasks-section">
          <h2>Tasks ({tasks.length})</h2>
          
          {/* DAG Visualization */}
          {tasks.length > 0 && <TaskDAG key={dagKey} projectId={id} />}
          
          {tasks.length === 0 ? (
            <div className="empty-state">
              <p>No tasks yet. Create your first task to get started!</p>
            </div>
          ) : (
            <div className="tasks-list">
              {tasks.map((task) => {
                // Find allocation for this task
                const allocation = allocations.find(a => a.task_id === task.id);
                
                return (
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
                      ⏱️ {task.estimated_duration} minutes (Priority: {task.priority})
                    </span>
                    {task.required_skills && task.required_skills.length > 0 && (
                      <span className="task-skills">
                        🛠️ {task.required_skills.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="task-status">
                    <span className={`status-badge status-${task.status}`}>
                      {task.status}
                    </span>
                  </div>
                  
                  {/* Show allocation info */}
                  {allocation && (
                    <div className="task-assignment">
                      <div style={{marginBottom: '0.5rem'}}>
                        <strong>✅ Assigned to: {allocation.resource_name}</strong>
                      </div>
                      <div style={{fontSize: '12px', color: '#155724'}}>
                        📅 Start: {new Date(allocation.scheduled_start).toLocaleString()}
                      </div>
                      <div style={{fontSize: '12px', color: '#155724'}}>
                        📅 End: {new Date(allocation.scheduled_end).toLocaleString()}
                      </div>
                    </div>
                  )}
                </div>
              )})}
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
                <label>Task Name *</label>
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
                <label>Duration (minutes) *</label>
                <input
                  type="number"
                  min="1"
                  value={newTask.estimated_duration}
                  onChange={(e) => setNewTask({...newTask, estimated_duration: e.target.value})}
                  required
                />
                <small style={{color: '#666', fontSize: '12px'}}>
                  Example: 60 = 1 hour, 240 = 4 hours, 480 = 1 day
                </small>
              </div>
              <div className="form-group">
                <label>Priority (1-5) *</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value})}
                  required
                />
                <small style={{color: '#666', fontSize: '12px'}}>
                  1 = Low priority, 5 = High priority
                </small>
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
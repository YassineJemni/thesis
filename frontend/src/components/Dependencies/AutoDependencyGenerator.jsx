// src/components/Dependencies/AutoDependencyGenerator.jsx
import React, { useState } from 'react';
import './AutoDependencyGenerator.css';

function AutoDependencyGenerator({ projectId, tasks, onDependenciesGenerated }) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Smart dependency detection algorithm
  const detectDependencies = () => {
    const suggestions = [];

    // Strategy 1: Keyword-based detection
    const keywordRules = [
      { keywords: ['requirement', 'analysis', 'planning'], phase: 1 },
      { keywords: ['design', 'mockup', 'wireframe', 'prototype'], phase: 2 },
      { keywords: ['frontend', 'backend', 'development', 'implementation', 'coding'], phase: 3 },
      { keywords: ['testing', 'qa', 'quality', 'test'], phase: 4 },
      { keywords: ['deployment', 'release', 'launch', 'production'], phase: 5 },
    ];

    // Assign phases to tasks
    const tasksWithPhases = tasks.map(task => {
      const taskText = (task.name + ' ' + (task.description || '')).toLowerCase();
      
      for (const rule of keywordRules) {
        for (const keyword of rule.keywords) {
          if (taskText.includes(keyword)) {
            return { ...task, phase: rule.phase, matchedKeyword: keyword };
          }
        }
      }
      
      return { ...task, phase: task.priority || 3, matchedKeyword: null };
    });

    // Strategy 2: Create dependencies between phases
    const sortedTasks = [...tasksWithPhases].sort((a, b) => a.phase - b.phase);
    
    for (let i = 0; i < sortedTasks.length - 1; i++) {
      const current = sortedTasks[i];
      const next = sortedTasks[i + 1];
      
      // If next task is in a later phase, create dependency
      if (next.phase > current.phase) {
        suggestions.push({
          predecessor: current,
          successor: next,
          reason: `${getPhaseName(current.phase)} should complete before ${getPhaseName(next.phase)}`,
          confidence: 'high'
        });
      }
    }

    // Strategy 3: Priority-based dependencies
    // Higher priority tasks should complete before lower priority
    const priorityGroups = {};
    tasks.forEach(task => {
      if (!priorityGroups[task.priority]) {
        priorityGroups[task.priority] = [];
      }
      priorityGroups[task.priority].push(task);
    });

    const priorities = Object.keys(priorityGroups).sort((a, b) => b - a); // High to low
    for (let i = 0; i < priorities.length - 1; i++) {
      const highPriorityTasks = priorityGroups[priorities[i]];
      const lowerPriorityTasks = priorityGroups[priorities[i + 1]];
      
      // Connect last high-priority task to first low-priority task
      if (highPriorityTasks.length > 0 && lowerPriorityTasks.length > 0) {
        const predecessor = highPriorityTasks[highPriorityTasks.length - 1];
        const successor = lowerPriorityTasks[0];
        
        // Only add if not already suggested
        const alreadyExists = suggestions.some(
          s => s.predecessor.id === predecessor.id && s.successor.id === successor.id
        );
        
        if (!alreadyExists) {
          suggestions.push({
            predecessor,
            successor,
            reason: `Priority ${predecessor.priority} tasks before priority ${successor.priority}`,
            confidence: 'medium'
          });
        }
      }
    }

    // Strategy 4: Skill-based dependencies
    // If Task B requires skills that Task A produces
    const skillFlowRules = {
      'requirements': ['design', 'ui/ux'],
      'design': ['frontend', 'react', 'vue', 'css'],
      'frontend': ['testing', 'qa'],
      'backend': ['testing', 'qa'],
      'api': ['frontend', 'integration']
    };

    tasks.forEach(taskA => {
      const aSkills = taskA.required_skills || [];
      
      tasks.forEach(taskB => {
        if (taskA.id === taskB.id) return;
        
        const bSkills = taskB.required_skills || [];
        
        // Check if A produces what B needs
        aSkills.forEach(aSkill => {
          const produces = skillFlowRules[aSkill.toLowerCase()] || [];
          const needsOutput = bSkills.some(bSkill => 
            produces.includes(bSkill.toLowerCase())
          );
          
          if (needsOutput) {
            const alreadyExists = suggestions.some(
              s => s.predecessor.id === taskA.id && s.successor.id === taskB.id
            );
            
            if (!alreadyExists) {
              suggestions.push({
                predecessor: taskA,
                successor: taskB,
                reason: `"${taskA.name}" produces outputs needed by "${taskB.name}"`,
                confidence: 'medium'
              });
            }
          }
        });
      });
    });

    // Remove duplicates
    const uniqueSuggestions = suggestions.filter((suggestion, index, self) =>
      index === self.findIndex(s => 
        s.predecessor.id === suggestion.predecessor.id && 
        s.successor.id === suggestion.successor.id
      )
    );

    return uniqueSuggestions;
  };

  const getPhaseName = (phase) => {
    const phases = {
      1: 'Planning/Requirements',
      2: 'Design',
      3: 'Development',
      4: 'Testing',
      5: 'Deployment'
    };
    return phases[phase] || 'Work';
  };

  const handleAnalyze = () => {
    if (tasks.length < 2) {
      alert('Need at least 2 tasks to detect dependencies');
      return;
    }

    setLoading(true);
    
    // Simulate processing time for better UX
    setTimeout(() => {
      const detected = detectDependencies();
      setSuggestions(detected);
      setShowModal(true);
      setLoading(false);
    }, 500);
  };

  const handleCreateDependencies = async (selectedSuggestions) => {
    setLoading(true);
    const token = localStorage.getItem('token');
    let successCount = 0;
    let errorCount = 0;

    for (const suggestion of selectedSuggestions) {
      try {
        const response = await fetch('http://localhost:8000/api/tasks/dependencies', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            predecessor_task_id: suggestion.predecessor.id,
            successor_task_id: suggestion.successor.id
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        console.error('Error creating dependency:', error);
      }
    }

    setLoading(false);
    setShowModal(false);
    
    alert(`✅ Created ${successCount} dependencies${errorCount > 0 ? `\n⚠️ ${errorCount} failed (might already exist or create cycles)` : ''}`);
    
    if (onDependenciesGenerated) {
      onDependenciesGenerated();
    }
  };

  const handleCreateAll = () => {
    if (window.confirm(`Create all ${suggestions.length} suggested dependencies?`)) {
      handleCreateDependencies(suggestions);
    }
  };

  const handleCreateSelected = (suggestion) => {
    handleCreateDependencies([suggestion]);
  };

  return (
    <>
      <button
        onClick={handleAnalyze}
        className="btn-auto-dependency"
        disabled={loading || tasks.length < 2}
        title={tasks.length < 2 ? "Need at least 2 tasks" : "Auto-detect dependencies"}
      >
        {loading ? '🔄 Analyzing...' : '🤖 Auto-Detect Dependencies'}
      </button>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🤖 Auto-Detected Dependencies</h2>
              <button onClick={() => setShowModal(false)} className="close-btn">
                ×
              </button>
            </div>

            <div className="auto-dependency-info">
              <p>
                <strong>Found {suggestions.length} suggested dependencies</strong> based on:
              </p>
              <ul>
                <li>📋 Task names and descriptions</li>
                <li>⭐ Task priorities</li>
                <li>🛠️ Skill requirements</li>
                <li>📊 Standard workflow patterns</li>
              </ul>
            </div>

            {suggestions.length === 0 ? (
              <div className="no-suggestions">
                <p>No automatic dependencies detected.</p>
                <p>Try adding more descriptive task names or use manual dependency creation.</p>
              </div>
            ) : (
              <>
                <div className="suggestions-list">
                  {suggestions.map((suggestion, index) => (
                    <div key={index} className="suggestion-card">
                      <div className="suggestion-header">
                        <span className={`confidence-badge confidence-${suggestion.confidence}`}>
                          {suggestion.confidence} confidence
                        </span>
                      </div>
                      
                      <div className="suggestion-flow">
                        <div className="task-box predecessor">
                          <div className="task-name">{suggestion.predecessor.name}</div>
                          <div className="task-meta">
                            Priority: {suggestion.predecessor.priority} | 
                            Duration: {suggestion.predecessor.estimated_duration}min
                          </div>
                        </div>
                        
                        <div className="flow-arrow">→</div>
                        
                        <div className="task-box successor">
                          <div className="task-name">{suggestion.successor.name}</div>
                          <div className="task-meta">
                            Priority: {suggestion.successor.priority} | 
                            Duration: {suggestion.successor.estimated_duration}min
                          </div>
                        </div>
                      </div>
                      
                      <div className="suggestion-reason">
                        <strong>Reason:</strong> {suggestion.reason}
                      </div>
                      
                      <button
                        onClick={() => handleCreateSelected(suggestion)}
                        className="btn-create-single"
                        disabled={loading}
                      >
                        Create This Dependency
                      </button>
                    </div>
                  ))}
                </div>

                <div className="modal-footer">
                  <button 
                    onClick={() => setShowModal(false)} 
                    className="btn-secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateAll}
                    className="btn-primary"
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : `Create All ${suggestions.length} Dependencies`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AutoDependencyGenerator;
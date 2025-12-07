// src/components/DAG/TaskDAG.jsx
import React, { useEffect, useState } from 'react';
import './TaskDAG.css';

function TaskDAG({ projectId }) {
  const [dagData, setDagData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDAG();
  }, [projectId]);

  const fetchDAG = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/projects/${projectId}/dag`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch DAG');
      
      const data = await response.json();
      setDagData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateLayout = (nodes, edges) => {
    // Simple layered layout algorithm
    const nodeMap = new Map(nodes.map(n => [n.id, { ...n, level: 0, x: 0, y: 0 }]));
    
    // Calculate levels (topological ordering)
    const inDegree = new Map(nodes.map(n => [n.id, 0]));
    edges.forEach(e => inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1));
    
    const queue = nodes.filter(n => inDegree.get(n.id) === 0).map(n => n.id);
    const levels = [];
    
    while (queue.length > 0) {
      const currentLevel = [...queue];
      levels.push(currentLevel);
      queue.length = 0;
      
      currentLevel.forEach(nodeId => {
        const outEdges = edges.filter(e => e.from === nodeId);
        outEdges.forEach(edge => {
          const newDegree = inDegree.get(edge.to) - 1;
          inDegree.set(edge.to, newDegree);
          if (newDegree === 0) queue.push(edge.to);
        });
      });
    }
    
    // Position nodes
    const nodeWidth = 180;
    const nodeHeight = 80;
    const levelGap = 150;
    const nodeGap = 50;
    
    levels.forEach((level, levelIndex) => {
      level.forEach((nodeId, indexInLevel) => {
        const node = nodeMap.get(nodeId);
        node.level = levelIndex;
        node.x = 50 + indexInLevel * (nodeWidth + nodeGap);
        node.y = 50 + levelIndex * (levelGap + nodeHeight);
      });
    });
    
    return Array.from(nodeMap.values());
  };

  const getPriorityColor = (priority) => {
    const colors = {
      5: '#ef4444', // High - Red
      4: '#f97316', // Medium-High - Orange
      3: '#eab308', // Medium - Yellow
      2: '#3b82f6', // Medium-Low - Blue
      1: '#6b7280'  // Low - Gray
    };
    return colors[priority] || colors[3];
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': '#6b7280',
      'in_progress': '#3b82f6',
      'completed': '#10b981',
      'blocked': '#ef4444'
    };
    return colors[status] || '#6b7280';
  };

  if (loading) return <div className="dag-loading">Loading DAG...</div>;
  if (error) return <div className="dag-error">Error: {error}</div>;
  if (!dagData || dagData.nodes.length === 0) {
    return <div className="dag-empty">No tasks to visualize. Add tasks first!</div>;
  }

  const positionedNodes = calculateLayout(dagData.nodes, dagData.edges);
  
  // Calculate SVG size
  const maxX = Math.max(...positionedNodes.map(n => n.x)) + 200;
  const maxY = Math.max(...positionedNodes.map(n => n.y)) + 100;

  return (
    <div className="dag-container">
      <div className="dag-header">
        <h3>📊 Task Dependency Graph (DAG)</h3>
        <div className="dag-legend">
          <span><span className="legend-dot" style={{background: '#ef4444'}}></span> High Priority</span>
          <span><span className="legend-dot" style={{background: '#f97316'}}></span> Medium-High</span>
          <span><span className="legend-dot" style={{background: '#eab308'}}></span> Medium</span>
          <span><span className="legend-dot" style={{background: '#3b82f6'}}></span> Low Priority</span>
        </div>
      </div>
      
      <div className="dag-canvas">
        <svg 
          width={Math.max(maxX, 800)} 
          height={Math.max(maxY, 400)}
          style={{ border: '1px solid #e0e0e0', borderRadius: '8px', background: '#fafafa' }}
        >
          {/* Draw edges first (so they appear behind nodes) */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 10 3, 0 6" fill="#666" />
            </marker>
          </defs>
          
          {dagData.edges.map((edge, index) => {
            const fromNode = positionedNodes.find(n => n.id === edge.from);
            const toNode = positionedNodes.find(n => n.id === edge.to);
            
            if (!fromNode || !toNode) return null;
            
            const x1 = fromNode.x + 90; // Center of node
            const y1 = fromNode.y + 70; // Bottom of node
            const x2 = toNode.x + 90;   // Center of node
            const y2 = toNode.y + 10;   // Top of node
            
            return (
              <line
                key={index}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#666"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            );
          })}
          
          {/* Draw nodes */}
          {positionedNodes.map((node) => (
            <g key={node.id}>
              {/* Node background */}
              <rect
                x={node.x}
                y={node.y}
                width="180"
                height="70"
                rx="8"
                fill="white"
                stroke={getPriorityColor(node.priority)}
                strokeWidth="3"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                  cursor: 'pointer'
                }}
              />
              
              {/* Status indicator */}
              <rect
                x={node.x}
                y={node.y}
                width="180"
                height="8"
                rx="8"
                fill={getStatusColor(node.status)}
              />
              
              {/* Task name */}
              <text
                x={node.x + 90}
                y={node.y + 32}
                textAnchor="middle"
                fontSize="14"
                fontWeight="600"
                fill="#333"
              >
                {node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name}
              </text>
              
              {/* Priority badge */}
              <text
                x={node.x + 90}
                y={node.y + 52}
                textAnchor="middle"
                fontSize="11"
                fill="#666"
              >
                Priority: {node.priority}
              </text>
              
              {/* Task ID */}
              <text
                x={node.x + 90}
                y={node.y + 65}
                textAnchor="middle"
                fontSize="10"
                fill="#999"
              >
                ID: {node.id}
              </text>
            </g>
          ))}
        </svg>
      </div>
      
      <div className="dag-info">
        <p>📌 <strong>{dagData.nodes.length}</strong> tasks, <strong>{dagData.edges.length}</strong> dependencies</p>
        <p style={{fontSize: '12px', color: '#666'}}>
          ℹ️ Arrows show task dependencies (prerequisite → dependent task)
        </p>
      </div>
    </div>
  );
}

export default TaskDAG;
"""
Resource Allocation System - Main Application
FastAPI Backend for Context-Aware Resource Allocation
"""

from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.openapi.utils import get_openapi
from sqlalchemy import create_engine, Column, Integer, String, Text, Float, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from sqlalchemy.dialects.sqlite import JSON
from pydantic import BaseModel, EmailStr, ConfigDict
from passlib.context import CryptContext
import jwt
from jwt.exceptions import InvalidTokenError
from datetime import datetime, timedelta
from typing import List, Optional
import enum

# ============================================================================
# CONFIGURATION
# ============================================================================

DATABASE_URL = "sqlite:///./resource_allocation.db"
SECRET_KEY = "your-secret-key-change-in-production-09af8s7df687asdf"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# ============================================================================
# DATABASE SETUP
# ============================================================================

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ============================================================================
# ENUMS
# ============================================================================

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    EMPLOYEE = "employee"

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    BLOCKED = "blocked"

class ProjectStatus(str, enum.Enum):
    PLANNING = "planning"
    ACTIVE = "active"
    COMPLETED = "completed"

class ResourceType(str, enum.Enum):
    EMPLOYEE = "employee"
    EQUIPMENT = "equipment"

# ============================================================================
# DATABASE MODELS
# ============================================================================

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.EMPLOYEE)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    projects = relationship("Project", back_populates="owner")

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey("users.id"))
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.PLANNING)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    owner = relationship("User", back_populates="projects")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")

class Task(Base):
    __tablename__ = "tasks"
    
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text)
    estimated_duration = Column(Integer, nullable=False)
    actual_duration = Column(Integer)
    priority = Column(Integer, default=3)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING)
    required_skills = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    project = relationship("Project", back_populates="tasks")
    predecessor_deps = relationship("TaskDependency", foreign_keys="TaskDependency.successor_task_id", back_populates="successor")
    successor_deps = relationship("TaskDependency", foreign_keys="TaskDependency.predecessor_task_id", back_populates="predecessor")
    allocations = relationship("TaskAllocation", back_populates="task")

class TaskDependency(Base):
    __tablename__ = "task_dependencies"
    
    id = Column(Integer, primary_key=True, index=True)
    predecessor_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    successor_task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    predecessor = relationship("Task", foreign_keys=[predecessor_task_id], back_populates="successor_deps")
    successor = relationship("Task", foreign_keys=[successor_task_id], back_populates="predecessor_deps")

class Resource(Base):
    __tablename__ = "resources"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    type = Column(SQLEnum(ResourceType), nullable=False)
    skills = Column(JSON)
    cost_per_hour = Column(Float, default=0.0)
    available = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    allocations = relationship("TaskAllocation", back_populates="resource")

class TaskAllocation(Base):
    __tablename__ = "task_allocations"
    
    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    resource_id = Column(Integer, ForeignKey("resources.id"), nullable=False)
    scheduled_start = Column(DateTime)
    scheduled_end = Column(DateTime)
    actual_start = Column(DateTime)
    actual_end = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    task = relationship("Task", back_populates="allocations")
    resource = relationship("Resource", back_populates="allocations")

# Create all tables
Base.metadata.create_all(bind=engine)

# ============================================================================
# PYDANTIC SCHEMAS (Request/Response Models)
# ============================================================================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: UserRole = UserRole.EMPLOYEE

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: UserRole
    
    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: ProjectStatus
    owner_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    name: str
    description: Optional[str] = None
    estimated_duration: int
    priority: int = 3
    required_skills: List[str] = []

class TaskResponse(BaseModel):
    id: int
    project_id: int
    name: str
    description: Optional[str]
    estimated_duration: int
    priority: int
    status: TaskStatus
    required_skills: List[str]
    created_at: datetime
    
    class Config:
        from_attributes = True

class DependencyCreate(BaseModel):
    predecessor_task_id: int
    successor_task_id: int

class ResourceCreate(BaseModel):
    name: str
    type: ResourceType
    skills: List[str] = []
    cost_per_hour: float = 0.0

class ResourceResponse(BaseModel):
    id: int
    name: str
    type: ResourceType
    skills: List[str]
    cost_per_hour: float
    available: bool
    
    class Config:
        from_attributes = True

class AllocationResponse(BaseModel):
    id: int
    task_id: int
    resource_id: int
    scheduled_start: Optional[datetime]
    scheduled_end: Optional[datetime]
    
    class Config:
        from_attributes = True

# ============================================================================
# SECURITY & AUTHENTICATION
# ============================================================================

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except InvalidTokenError:
        raise credentials_exception
    
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception
    return user

# ============================================================================
# ALGORITHMS
# ============================================================================

def has_cycle(db: Session, project_id: int) -> bool:
    """Detect cycles in task dependency graph using DFS"""
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    dependencies = db.query(TaskDependency).join(Task, TaskDependency.predecessor_task_id == Task.id).filter(Task.project_id == project_id).all()
    
    # Build adjacency list
    graph = {task.id: [] for task in tasks}
    for dep in dependencies:
        graph[dep.predecessor_task_id].append(dep.successor_task_id)
    
    visited = set()
    rec_stack = set()
    
    def dfs(node):
        visited.add(node)
        rec_stack.add(node)
        
        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                if dfs(neighbor):
                    return True
            elif neighbor in rec_stack:
                return True
        
        rec_stack.remove(node)
        return False
    
    for task_id in graph:
        if task_id not in visited:
            if dfs(task_id):
                return True
    
    return False

def topological_sort(db: Session, project_id: int) -> List[Task]:
    """Sort tasks in dependency order"""
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    dependencies = db.query(TaskDependency).join(Task, TaskDependency.predecessor_task_id == Task.id).filter(Task.project_id == project_id).all()
    
    # Build adjacency list and in-degree count
    graph = {task.id: [] for task in tasks}
    in_degree = {task.id: 0 for task in tasks}
    task_map = {task.id: task for task in tasks}
    
    for dep in dependencies:
        graph[dep.predecessor_task_id].append(dep.successor_task_id)
        in_degree[dep.successor_task_id] += 1
    
    # Kahn's algorithm
    queue = [tid for tid in in_degree if in_degree[tid] == 0]
    sorted_tasks = []
    
    while queue:
        # Sort by priority for deterministic ordering
        queue.sort(key=lambda tid: -task_map[tid].priority)
        current = queue.pop(0)
        sorted_tasks.append(task_map[current])
        
        for neighbor in graph[current]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
    
    return sorted_tasks

def allocate_resources(db: Session, project_id: int):
    """Simple resource allocation algorithm"""
    sorted_tasks = topological_sort(db, project_id)
    resources = db.query(Resource).filter(Resource.available == True).all()
    
    if not resources:
        raise HTTPException(status_code=400, detail="No available resources")
    
    current_time = datetime.utcnow()
    allocations = []
    
    for task in sorted_tasks:
        # Find best resource (simple: first available with matching skills)
        best_resource = None
        
        for resource in resources:
            if resource.type == ResourceType.EMPLOYEE:
                # Check skill match
                if all(skill in resource.skills for skill in task.required_skills):
                    best_resource = resource
                    break
        
        # If no skill match, use first available
        if not best_resource:
            best_resource = resources[0]
        
        # Schedule task
        scheduled_start = current_time
        scheduled_end = current_time + timedelta(minutes=task.estimated_duration)
        
        allocation = TaskAllocation(
            task_id=task.id,
            resource_id=best_resource.id,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end
        )
        db.add(allocation)
        allocations.append(allocation)
        
        # Update current time for next task
        current_time = scheduled_end
    
    db.commit()
    return allocations

# ============================================================================
# FASTAPI APPLICATION
# ============================================================================

app = FastAPI(
    title="Resource Allocation System API",
    description="Context-Aware Resource Allocation for Small Businesses",
    version="1.0.0"
)

# Custom OpenAPI schema for proper authentication in Swagger UI
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes
    )

    # Add Bearer authentication scheme
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
def root():
    """Health check endpoint"""
    return {
        "message": "Resource Allocation System API",
        "status": "active",
        "version": "1.0.0",
        "docs": "/docs"
    }

# ==================== AUTHENTICATION ====================

@app.post("/api/auth/register", response_model=UserResponse)
def register(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_password = get_password_hash(user.password)
    new_user = User(
        email=user.email,
        password_hash=hashed_password,
        full_name=user.full_name,
        role=user.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        role=new_user.role
    )

@app.post("/api/auth/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Login and get access token"""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    
    access_token = create_access_token(data={"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information"""
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role
    )

# ==================== PROJECTS ====================

@app.post("/api/projects", response_model=ProjectResponse)
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project - TESTING MODE"""
    # Get or create a default user for testing
    user = db.query(User).first()
    if not user:
        hashed_password = get_password_hash("admin123")
        user = User(
            email="admin@test.com",
            password_hash=hashed_password,
            full_name="Admin User",
            role=UserRole.ADMIN
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    
    new_project = Project(
        name=project.name,
        description=project.description,
        owner_id=user.id
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    
    return ProjectResponse(
        id=new_project.id,
        name=new_project.name,
        description=new_project.description,
        status=new_project.status,
        owner_id=new_project.owner_id,
        created_at=new_project.created_at
    )

@app.get("/api/projects", response_model=List[ProjectResponse])
def list_projects(db: Session = Depends(get_db)):
    """List all projects"""
    projects = db.query(Project).all()
    return projects

@app.get("/api/projects/{project_id}", response_model=ProjectResponse)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get project by ID"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@app.delete("/api/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    return {"message": "Project deleted successfully"}

# ==================== TASKS ====================

@app.post("/api/projects/{project_id}/tasks", response_model=TaskResponse)
def create_task(project_id: int, task: TaskCreate, db: Session = Depends(get_db)):
    """Create a new task in a project"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    new_task = Task(
        project_id=project_id,
        name=task.name,
        description=task.description,
        estimated_duration=task.estimated_duration,
        priority=task.priority,
        required_skills=task.required_skills if task.required_skills else []
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task

@app.get("/api/projects/{project_id}/tasks", response_model=List[TaskResponse])
def list_tasks(project_id: int, db: Session = Depends(get_db)):
    """List all tasks in a project"""
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    return tasks

@app.get("/api/tasks/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    """Get task by ID"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
def update_task(task_id: int, task_update: TaskCreate, db: Session = Depends(get_db)):
    """Update a task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.name = task_update.name
    task.description = task_update.description
    task.estimated_duration = task_update.estimated_duration
    task.priority = task_update.priority
    task.required_skills = task_update.required_skills
    
    db.commit()
    db.refresh(task)
    return task

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    """Delete a task"""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}

# ==================== DEPENDENCIES ====================

@app.post("/api/tasks/dependencies")
def create_dependency(dependency: DependencyCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a task dependency"""
    pred_task = db.query(Task).filter(Task.id == dependency.predecessor_task_id).first()
    succ_task = db.query(Task).filter(Task.id == dependency.successor_task_id).first()
    
    if not pred_task or not succ_task:
        raise HTTPException(status_code=404, detail="One or both tasks not found")
    
    if pred_task.project_id != succ_task.project_id:
        raise HTTPException(status_code=400, detail="Tasks must be in the same project")
    
    new_dep = TaskDependency(
        predecessor_task_id=dependency.predecessor_task_id,
        successor_task_id=dependency.successor_task_id
    )
    db.add(new_dep)
    db.commit()
    
    # Check for cycles
    if has_cycle(db, pred_task.project_id):
        db.rollback()
        raise HTTPException(status_code=400, detail="This dependency creates a cycle")
    
    db.commit()
    return {"message": "Dependency created successfully", "id": new_dep.id}

@app.get("/api/projects/{project_id}/dag")
def get_dag(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get DAG representation of project tasks"""
    tasks = db.query(Task).filter(Task.project_id == project_id).all()
    dependencies = db.query(TaskDependency).join(Task, TaskDependency.predecessor_task_id == Task.id).filter(Task.project_id == project_id).all()
    
    nodes = [{"id": t.id, "name": t.name, "status": t.status.value, "priority": t.priority} for t in tasks]
    edges = [{"from": d.predecessor_task_id, "to": d.successor_task_id} for d in dependencies]
    
    return {"nodes": nodes, "edges": edges}

# ==================== RESOURCES ====================

@app.post("/api/resources", response_model=ResourceResponse)
def create_resource(resource: ResourceCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Create a new resource"""
    new_resource = Resource(
        name=resource.name,
        type=resource.type,
        skills=resource.skills if resource.skills else [],
        cost_per_hour=resource.cost_per_hour
    )
    db.add(new_resource)
    db.commit()
    db.refresh(new_resource)
    return new_resource

@app.get("/api/resources", response_model=List[ResourceResponse])
def list_resources(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all resources"""
    resources = db.query(Resource).all()
    return resources

@app.get("/api/resources/{resource_id}", response_model=ResourceResponse)
def get_resource(resource_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get resource by ID"""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@app.put("/api/resources/{resource_id}/availability")
def update_availability(resource_id: int, available: bool, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update resource availability"""
    resource = db.query(Resource).filter(Resource.id == resource_id).first()
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    
    resource.available = available
    db.commit()
    return {"message": "Availability updated", "available": available}

# ==================== ALLOCATIONS ====================

@app.post("/api/projects/{project_id}/allocate", response_model=List[AllocationResponse])
def auto_allocate(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Automatically allocate resources to tasks"""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if has_cycle(db, project_id):
        raise HTTPException(status_code=400, detail="Cannot allocate: project has circular dependencies")
    
    allocations = allocate_resources(db, project_id)
    return allocations

@app.get("/api/projects/{project_id}/schedule")
def get_schedule(project_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Get project schedule"""
    allocations = db.query(TaskAllocation).join(Task).filter(Task.project_id == project_id).all()
    
    schedule = []
    for alloc in allocations:
        schedule.append({
            "task_id": alloc.task_id,
            "task_name": alloc.task.name,
            "resource_id": alloc.resource_id,
            "resource_name": alloc.resource.name,
            "scheduled_start": alloc.scheduled_start,
            "scheduled_end": alloc.scheduled_end
        })
    
    return {"schedule": schedule}

# ============================================================================
# RUN APPLICATION
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting Resource Allocation System API...")
    print("📚 API Documentation: http://localhost:8000/docs")
    print("📧 Alternative docs: http://localhost:8000/redoc")
    uvicorn.run(app, host="0.0.0.0", port=8000)
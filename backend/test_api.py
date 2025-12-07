"""
Complete Testing Script for Resource Allocation System
Run this to test all endpoints systematically
"""

import requests
import json
from datetime import datetime

BASE_URL = "http://localhost:8000"

# Color codes for terminal output
class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(name, status, details=""):
    """Print formatted test result"""
    color = Colors.GREEN if status == "PASS" else Colors.RED
    print(f"{color}{'✓' if status == 'PASS' else '✗'} {name}{Colors.END}")
    if details:
        print(f"  {details}")

def print_section(name):
    """Print section header"""
    print(f"\n{Colors.BLUE}{'='*60}")
    print(f"  {name}")
    print(f"{'='*60}{Colors.END}\n")

# Store data for cross-test usage
test_data = {
    "token": None,
    "user_id": None,
    "user_email": None,
    "user_password": None,
    "project_id": None,
    "task_ids": [],
    "resource_ids": []
}

def test_health_check():
    """Test 1: Health Check"""
    print_section("TEST 1: Health Check")
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            data = response.json()
            print_test("Health Check", "PASS", f"Status: {data.get('status')}, Version: {data.get('version')}")
            return True
        else:
            print_test("Health Check", "FAIL", f"Status code: {response.status_code}")
            return False
    except Exception as e:
        print_test("Health Check", "FAIL", str(e))
        return False

def test_register_user():
    """Test 2: Register User"""
    print_section("TEST 2: Register User")
    try:
        # Create unique user
        timestamp = datetime.now().timestamp()
        email = f"test_user_{timestamp}@example.com"
        password = "testpass123"
        
        payload = {
            "email": email,
            "password": password,
            "full_name": "Test User",
            "role": "manager"
        }
        response = requests.post(f"{BASE_URL}/api/auth/register", json=payload)
        if response.status_code == 200:
            data = response.json()
            test_data["user_id"] = data.get("id")
            test_data["user_email"] = email
            test_data["user_password"] = password
            print_test("Register User", "PASS", f"User ID: {data.get('id')}, Email: {email}")
            return True
        else:
            print_test("Register User", "FAIL", f"Status: {response.status_code}, {response.text}")
            return False
    except Exception as e:
        print_test("Register User", "FAIL", str(e))
        return False

def test_login_user():
    """Test 3: Login User"""
    print_section("TEST 3: Login User")
    try:
        # Login with the user we just created
        if not test_data["user_email"] or not test_data["user_password"]:
            print_test("Login User", "FAIL", "No user credentials available from registration")
            return False
        
        payload = {
            "username": test_data["user_email"],
            "password": test_data["user_password"]
        }
        response = requests.post(f"{BASE_URL}/api/auth/login", data=payload)
        if response.status_code == 200:
            data = response.json()
            test_data["token"] = data.get("access_token")
            print_test("Login User", "PASS", f"Token received: {data.get('access_token')[:30]}...")
            return True
        else:
            print_test("Login User", "FAIL", f"Status: {response.status_code}, {response.text}")
            return False
    except Exception as e:
        print_test("Login User", "FAIL", str(e))
        return False

def test_create_project():
    """Test 4: Create Project"""
    print_section("TEST 4: Create Project")
    try:
        payload = {
            "name": "Test Project - Website Redesign",
            "description": "Complete redesign of company website"
        }
        response = requests.post(f"{BASE_URL}/api/projects", json=payload)
        if response.status_code == 200:
            data = response.json()
            test_data["project_id"] = data.get("id")
            print_test("Create Project", "PASS", f"Project ID: {data.get('id')}, Name: {data.get('name')}")
            return True
        else:
            print_test("Create Project", "FAIL", f"Status: {response.status_code}, {response.text}")
            return False
    except Exception as e:
        print_test("Create Project", "FAIL", str(e))
        return False

def test_create_tasks():
    """Test 5: Create Tasks"""
    print_section("TEST 5: Create Tasks")
    
    if not test_data["project_id"]:
        print_test("Create Tasks", "FAIL", "No project ID available")
        return False
    
    tasks = [
        {
            "name": "Requirements Gathering",
            "description": "Gather all website requirements",
            "estimated_duration": 240,
            "priority": 5,
            "required_skills": ["analysis", "communication"]
        },
        {
            "name": "Design Mockups",
            "description": "Create design mockups in Figma",
            "estimated_duration": 480,
            "priority": 4,
            "required_skills": ["design", "ui/ux"]
        },
        {
            "name": "Frontend Development",
            "description": "Implement frontend with React",
            "estimated_duration": 960,
            "priority": 3,
            "required_skills": ["react", "javascript", "css"]
        },
        {
            "name": "Backend API",
            "description": "Build REST API",
            "estimated_duration": 720,
            "priority": 3,
            "required_skills": ["python", "fastapi", "database"]
        },
        {
            "name": "Testing",
            "description": "QA and testing",
            "estimated_duration": 480,
            "priority": 2,
            "required_skills": ["testing", "qa"]
        }
    ]
    
    success_count = 0
    for task in tasks:
        try:
            response = requests.post(
                f"{BASE_URL}/api/projects/{test_data['project_id']}/tasks",
                json=task
            )
            if response.status_code == 200:
                data = response.json()
                test_data["task_ids"].append(data.get("id"))
                print_test(f"Create Task: {task['name']}", "PASS", f"Task ID: {data.get('id')}")
                success_count += 1
            else:
                print_test(f"Create Task: {task['name']}", "FAIL", f"Status: {response.status_code}, {response.text}")
        except Exception as e:
            print_test(f"Create Task: {task['name']}", "FAIL", str(e))
    
    return success_count == len(tasks)

def test_create_dependencies():
    """Test 6: Create Task Dependencies (DAG)"""
    print_section("TEST 6: Create Dependencies (DAG)")
    
    if len(test_data["task_ids"]) < 5:
        print_test("Create Dependencies", "FAIL", "Not enough tasks created")
        return False
    
    if not test_data["token"]:
        print_test("Create Dependencies", "FAIL", "No authentication token")
        return False
    
    # Create dependency chain
    dependencies = [
        {"predecessor_task_id": test_data["task_ids"][0], "successor_task_id": test_data["task_ids"][1]},
        {"predecessor_task_id": test_data["task_ids"][1], "successor_task_id": test_data["task_ids"][2]},
        {"predecessor_task_id": test_data["task_ids"][1], "successor_task_id": test_data["task_ids"][3]},
        {"predecessor_task_id": test_data["task_ids"][2], "successor_task_id": test_data["task_ids"][4]},
        {"predecessor_task_id": test_data["task_ids"][3], "successor_task_id": test_data["task_ids"][4]},
    ]
    
    headers = {"Authorization": f"Bearer {test_data['token']}"}
    success_count = 0
    
    for dep in dependencies:
        try:
            response = requests.post(
                f"{BASE_URL}/api/tasks/dependencies",
                json=dep,
                headers=headers
            )
            if response.status_code == 200:
                print_test(f"Dependency {dep['predecessor_task_id']} -> {dep['successor_task_id']}", "PASS")
                success_count += 1
            else:
                print_test(f"Dependency {dep['predecessor_task_id']} -> {dep['successor_task_id']}", "FAIL", response.text)
        except Exception as e:
            print_test(f"Dependency creation", "FAIL", str(e))
    
    return success_count == len(dependencies)

def test_view_dag():
    """Test 7: View DAG"""
    print_section("TEST 7: View DAG")
    
    if not test_data["token"]:
        print_test("View DAG", "FAIL", "No authentication token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/dag",
            headers=headers
        )
        if response.status_code == 200:
            data = response.json()
            print_test("View DAG", "PASS", f"Nodes: {len(data.get('nodes', []))}, Edges: {len(data.get('edges', []))}")
            print(f"\n  {Colors.YELLOW}DAG Structure:{Colors.END}")
            for edge in data.get('edges', []):
                print(f"    Task {edge['from']} -> Task {edge['to']}")
            return True
        else:
            print_test("View DAG", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_test("View DAG", "FAIL", str(e))
        return False

def test_create_resources():
    """Test 8: Create Resources"""
    print_section("TEST 8: Create Resources")
    
    if not test_data["token"]:
        print_test("Create Resources", "FAIL", "No authentication token")
        return False
    
    resources = [
        {
            "name": "John Developer",
            "type": "employee",
            "skills": ["react", "javascript", "css", "python"],
            "cost_per_hour": 75.0
        },
        {
            "name": "Sarah Designer",
            "type": "employee",
            "skills": ["design", "ui/ux", "figma"],
            "cost_per_hour": 65.0
        },
        {
            "name": "Mike Backend",
            "type": "employee",
            "skills": ["python", "fastapi", "database", "postgresql"],
            "cost_per_hour": 80.0
        },
        {
            "name": "Lisa QA",
            "type": "employee",
            "skills": ["testing", "qa", "automation"],
            "cost_per_hour": 60.0
        }
    ]
    
    headers = {"Authorization": f"Bearer {test_data['token']}"}
    success_count = 0
    
    for resource in resources:
        try:
            response = requests.post(
                f"{BASE_URL}/api/resources",
                json=resource,
                headers=headers
            )
            if response.status_code == 200:
                data = response.json()
                test_data["resource_ids"].append(data.get("id"))
                print_test(f"Create Resource: {resource['name']}", "PASS", f"Resource ID: {data.get('id')}")
                success_count += 1
            else:
                print_test(f"Create Resource: {resource['name']}", "FAIL", f"Status: {response.status_code}")
        except Exception as e:
            print_test(f"Create Resource: {resource['name']}", "FAIL", str(e))
    
    return success_count == len(resources)

def test_auto_allocate():
    """Test 9: Auto-Allocate Resources (MAIN ALGORITHM)"""
    print_section("TEST 9: AUTO-ALLOCATE (Main Algorithm)")
    
    if not test_data["token"]:
        print_test("Auto-Allocate", "FAIL", "No authentication token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        response = requests.post(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/allocate",
            headers=headers
        )
        if response.status_code == 200:
            data = response.json()
            print_test("Auto-Allocate", "PASS", f"Allocations created: {len(data)}")
            print(f"\n  {Colors.YELLOW}Allocation Summary:{Colors.END}")
            for alloc in data[:5]:
                print(f"    Task {alloc['task_id']} -> Resource {alloc['resource_id']}")
                print(f"      Start: {alloc['scheduled_start']}")
                print(f"      End: {alloc['scheduled_end']}")
            return True
        else:
            print_test("Auto-Allocate", "FAIL", f"Status: {response.status_code}, {response.text}")
            return False
    except Exception as e:
        print_test("Auto-Allocate", "FAIL", str(e))
        return False

def test_view_schedule():
    """Test 10: View Schedule"""
    print_section("TEST 10: View Schedule")
    
    if not test_data["token"]:
        print_test("View Schedule", "FAIL", "No authentication token")
        return False
    
    try:
        headers = {"Authorization": f"Bearer {test_data['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/projects/{test_data['project_id']}/schedule",
            headers=headers
        )
        if response.status_code == 200:
            data = response.json()
            schedule = data.get('schedule', [])
            print_test("View Schedule", "PASS", f"Schedule entries: {len(schedule)}")
            print(f"\n  {Colors.YELLOW}Complete Schedule:{Colors.END}")
            for entry in schedule:
                print(f"    {entry['task_name']} ({entry['resource_name']})")
                print(f"      {entry['scheduled_start']} → {entry['scheduled_end']}")
            return True
        else:
            print_test("View Schedule", "FAIL", f"Status: {response.status_code}")
            return False
    except Exception as e:
        print_test("View Schedule", "FAIL", str(e))
        return False

def run_all_tests():
    """Run all tests in sequence"""
    print(f"\n{Colors.BLUE}{'='*60}")
    print("  RESOURCE ALLOCATION SYSTEM - COMPREHENSIVE TEST SUITE")
    print(f"{'='*60}{Colors.END}\n")
    
    results = []
    
    # Run tests in order
    results.append(("Health Check", test_health_check()))
    results.append(("Register User", test_register_user()))
    results.append(("Login User", test_login_user()))
    results.append(("Create Project", test_create_project()))
    results.append(("Create Tasks", test_create_tasks()))
    results.append(("Create Dependencies", test_create_dependencies()))
    results.append(("View DAG", test_view_dag()))
    results.append(("Create Resources", test_create_resources()))
    results.append(("Auto-Allocate", test_auto_allocate()))
    results.append(("View Schedule", test_view_schedule()))
    
    # Print summary
    print_section("TEST SUMMARY")
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "PASS" if result else "FAIL"
        print_test(test_name, status)
    
    print(f"\n{Colors.BLUE}{'='*60}{Colors.END}")
    color = Colors.GREEN if passed == total else Colors.YELLOW if passed > 0 else Colors.RED
    print(f"{color}Result: {passed}/{total} tests passed{Colors.END}")
    print(f"{Colors.BLUE}{'='*60}{Colors.END}\n")

if __name__ == "__main__":
    print(f"{Colors.YELLOW}Make sure your FastAPI server is running on http://localhost:8000{Colors.END}\n")
    input("Press Enter to start testing...")
    run_all_tests()
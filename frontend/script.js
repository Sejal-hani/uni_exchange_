const API_BASE = "http://localhost:5000/api";

// --- LOGIN & PERSISTENCE ---
async function handleLogin(e) {
    if(e) e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('currentUser', JSON.stringify(data.user));
            showDashboard();
        } else {
            alert(data.message || "Invalid credentials");
        }
    } catch (err) {
        console.error("Login Error:", err);
    }
}

function showDashboard() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    if (!user) return;

    document.getElementById('login-section').style.display = 'none';
    document.getElementById('dashboard-section').style.display = 'block';
    
    // Set Profile Tab info immediately from localStorage
    document.getElementById('prof-name').innerText = `${user.first_name} ${user.last_name}`;
    document.getElementById('prof-email').innerText = user.email;
    document.getElementById('prof-college-id').innerText = user.college_id;

    // Load initial tab data
    switchTab('browse');
}

// --- NAVIGATION & DATA FETCHING ---
async function switchTab(tabName) {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    // Show selected
    document.getElementById(`tab-${tabName}`).style.display = 'block';

    if (tabName === 'browse') fetchOthersProjects(user.user_id);
    if (tabName === 'my-projects') fetchMyProjects(user.user_id);
    if (tabName === 'wallet') fetchWallet(user.user_id);
}

async function fetchOthersProjects(userId) {
    const res = await fetch(`${API_BASE}/projects/others/${userId}`);
    const projects = await res.json();
    const container = document.getElementById('browse-items');
    container.innerHTML = projects.map(p => `
        <div class="project-card">
            <h4>${p.title}</h4>
            <p>${p.description}</p>
            <span>Budget: ₹${p.budget}</span>
            <button onclick="placeBid(${p.project_id})">Bid</button>
        </div>
    `).join('');
}

async function fetchMyProjects(userId) {
    const res = await fetch(`${API_BASE}/projects/my/${userId}`);
    const projects = await res.json();
    const container = document.getElementById('my-projects-items');
    container.innerHTML = projects.map(p => `
        <div class="project-card">
            <h4>${p.title}</h4>
            <p>Status: <strong>${p.status}</strong></p>
            <p>Budget: ₹${p.budget}</p>
        </div>
    `).join('');
}

async function fetchWallet(userId) {
    const res = await fetch(`${API_BASE}/wallet/${userId}`);
    const data = await res.json();
    document.getElementById('wallet-balance').innerText = `₹${data.balance}`;
}

// Check for existing session on load
window.onload = () => {
    if (localStorage.getItem('currentUser')) showDashboard();
};
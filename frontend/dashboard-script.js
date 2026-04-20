// 1. Get the user from local storage
const user = JSON.parse(localStorage.getItem('user'));

// If no user is logged in, send them back to the login page
if (!user) {
    window.location.href = 'index.html';
}

/**
 * HELPER: UI Logic for Deadlines and Status
 * Calculates if the project is due in hours or days
 */
function getDeadlineUI(dateStr) {
    const deadline = new Date(dateStr);
    const now = new Date();
    const diffMs = deadline - now;
    
    // Calculate hours and days
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHrs / 24);

    let label = "";
    let cssClass = "deadline-normal";

    if (diffMs < 0) {
        label = "Overdue";
        cssClass = "deadline-urgent";
    } else if (diffHrs < 24) {
        // Less than 24 hours: Show hours and use Red (Urgent)
        label = diffHrs <= 0 ? "Due now" : `${diffHrs} hours left`;
        cssClass = "deadline-urgent";
    } else if (diffDays === 1) {
        // Exactly tomorrow: Use Blue (Tomorrow)
        label = "Due Tomorrow";
        cssClass = "deadline-tomorrow";
    } else {
        // More than a day: Show days and use Gray/Black (Normal)
        label = `${diffDays} days left`;
        cssClass = "deadline-normal";
    }

    // Return the label with the date in parentheses
    return { 
        label: `${label} (${deadline.toLocaleDateString()})`, 
        class: cssClass 
    };
}

/**
 * Navigation Logic: This handles switching tabs and loading the data
 */
async function loadTab(tabName, element) {
    const mainContent = document.getElementById('main-content');
    
    try {
        const res = await fetch(`tabs/${tabName}.html`);
        const html = await res.text();
        mainContent.innerHTML = html;

        document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));
        if (element) {
            element.classList.add('active');
        }

        if (tabName === 'browse') {
            loadBrowse();
        } else if (tabName === 'my-projects') {
            loadMyProjects();
        } else if (tabName === 'wallet') {
            loadWallet();
        } else if (tabName === 'profile') {
            loadProfile();
        } else if (tabName === 'my-bids') {
            loadMyBids();
}
    } catch (err) {
        console.error("Error loading tab:", err);
        mainContent.innerHTML = "<p>Error loading content.</p>";
    }
}

async function loadBrowse() {
    const grid = document.getElementById('job-grid');
    if (!grid) return; 
    grid.innerHTML = "<p>Loading projects...</p>";

    try {
        const res = await fetch(`http://localhost:5000/api/projects/others/${user.user_id}`);
        const projects = await res.json();

        if (projects.length === 0) {
            grid.innerHTML = "<div style='padding:20px; background:white; border-radius:10px;'>No projects found.</div>";
            return;
        }

        grid.innerHTML = projects.map(p => {
            const dUI = getDeadlineUI(p.deadline);
            return `
            <div class="job-card">
                <div class="card-header">
                    <div class="client-icon">${p.first_name ? p.first_name[0] : 'U'}</div>
                    <div class="client-info">
                        <h4>${p.first_name || 'Anonymous'}</h4>
                        <span>BMU Campus</span>
                    </div>
                </div>
                <h3 class="title-large">${p.title}</h3>
                <div class="tag">${p.category_name}</div>
                <p class="job-desc">${p.description}</p>
                <div class="deadline-badge ${dUI.class}">📅 ${dUI.label}</div>
                <div class="card-footer">
                    <div class="price">₹${p.budget}<span>/fixed</span></div>
                    <button class="apply-btn" onclick="applyForProject(${p.project_id})">Apply Now</button>
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        grid.innerHTML = "<p>Error connecting to server.</p>";
    }
}

async function applyForProject(projectId) {
    const amount = prompt("Enter your bid amount (₹):");
    if (!amount) return;
    try {
        const res = await fetch('http://localhost:5000/api/proposals/apply', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ project_id: projectId, freelancer_id: user.user_id, amount: amount })
        });
        if (res.ok) alert("Application Sent!");
    } catch (err) { console.error(err); }
}

async function loadMyProjects() {
    const grid = document.getElementById('my-grid');
    if (!grid) return;
    populateCategories();

    try {
        const res = await fetch(`http://localhost:5000/api/projects/my/${user.user_id}`);
        const projects = await res.json();

        if (projects.length === 0) {
            grid.innerHTML = "<p>No projects posted yet.</p>";
            return;
        }

        grid.innerHTML = projects.map(p => {
            const dUI = getDeadlineUI(p.deadline);
            // Decide color and button based on status
            const statusClass = p.status === 'open' ? 'stat-open' : (p.status === 'in_progress' ? 'deadline-tomorrow' : 'stat-completed');
            
            let actionBtn = '';
            if (p.status === 'open') {
                actionBtn = `<button class="view-btn" onclick="viewProposals(${p.project_id})">View Proposals</button>`;
            } else if (p.status === 'in_progress') {
                actionBtn = `<button class="view-btn" style="background:#004aad; color:white;" onclick="completeProject(${p.project_id})">Mark Completed</button>`;
            }

            return `
            <div class="job-card">
                <div class="tag ${statusClass}">${p.status.toUpperCase().replace('_', ' ')}</div>
                <h3 class="title-large">${p.title}</h3>
                <p class="job-desc">${p.description}</p>
                <div class="deadline-badge ${dUI.class}">📅 ${dUI.label}</div>
                <div class="card-footer">
                    <div class="price">₹${p.budget}</div>
                    ${actionBtn}
                </div>
            </div>`;
        }).join('');
    } catch (err) {
        grid.innerHTML = "<p>Error loading projects.</p>";
    }
}

/**
 * PROPOSALS MANAGEMENT (NEW)
 */
async function viewProposals(projectId) {
    document.getElementById('proposals-modal-overlay').style.display = 'flex';
    const list = document.getElementById('proposals-list');
    list.innerHTML = "<p>Loading...</p>";
    try {
        const res = await fetch(`http://localhost:5000/api/proposals/project/${projectId}`);
        const bids = await res.json();
        if (bids.length === 0) {
            list.innerHTML = "<p style='text-align:center;'>No bids yet.</p>";
            return;
        }
        list.innerHTML = bids.map(b => `
            <div style="border-bottom:1px solid #eee; padding:10px 0; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong style="display:block;">${b.first_name} ${b.last_name}</strong>
                    <small style="color:#64748b;">Bid: ₹${b.proposal_amount}</small>
                </div>
                <button class="btn-blue" style="width:auto; padding:5px 10px; font-size:12px;" onclick="acceptBid(${projectId})">Accept</button>
            </div>
        `).join('');
    } catch (err) { console.error(err); }
}

function closeProposalsModal() {
    document.getElementById('proposals-modal-overlay').style.display = 'none';
}

async function acceptBid(projectId) {
    if (!confirm("Accept this freelancer and start project?")) return;
    try {
        const res = await fetch('http://localhost:5000/api/projects/accept', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ project_id: projectId })
        });
        if (res.ok) {
            alert("Freelancer Accepted! Project is now In Progress.");
            closeProposalsModal();
            loadMyProjects();
        }
    } catch (err) { console.error(err); }
}

async function completeProject(projectId) {
    if (!confirm("Are you sure this project is finished?")) return;
    try {
        const res = await fetch('http://localhost:5000/api/projects/complete', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ project_id: projectId })
        });
        if (res.ok) {
            alert("Project marked as Completed!");
            loadMyProjects();
        }
    } catch (err) { console.error(err); }
}

/** 
 * REMAINING FUNCTIONS (Wallet, Profile, Auth) kept exactly as your code 
 */
async function loadWallet() {
    const balEl = document.getElementById('bal');
    const transEl = document.getElementById('trans-list');
    if (!balEl || !transEl) return;
    try {
        const res = await fetch(`http://localhost:5000/api/wallet/${user.user_id}`);
        const data = await res.json();
        balEl.innerText = `₹${data.balance}`;
        const hRes = await fetch(`http://localhost:5000/api/wallet/history/${user.user_id}`);
        const history = await hRes.json();
        transEl.innerHTML = history.map(t => `
            <tr style="border-top:1px solid #f1f5f9;">
                <td style="padding:12px;">${t.transaction_type}</td>
                <td style="padding:12px; font-weight:bold;">₹${t.amount}</td>
                <td style="padding:12px; color:#94a3b8;">${new Date(t.created_at).toLocaleDateString()}</td>
            </tr>`).join('');
    } catch (err) { console.error(err); }
}

async function loadProfile() {
    const phoneEl = document.getElementById('p-phones');
    if (!phoneEl) return;
    document.getElementById('p-full').innerText = user.first_name + " " + user.last_name;
    document.getElementById('p-email').innerText = user.email;
    document.getElementById('p-id').innerText = user.college_id;
    if(document.getElementById('edit-fname')) document.getElementById('edit-fname').value = user.first_name;
    if(document.getElementById('edit-lname')) document.getElementById('edit-lname').value = user.last_name;
    try {
        const res = await fetch(`http://localhost:5000/api/profile/phones/${user.user_id}`);
        const data = await res.json();
        const phoneList = data.phones.join(', ');
        phoneEl.innerText = phoneList || "No phones registered";
        if(document.getElementById('edit-phones')) document.getElementById('edit-phones').value = phoneList;
        const sRes = await fetch(`http://localhost:5000/api/profile/stats/${user.user_id}`);
        const stats = await sRes.json();
        if(document.getElementById('p-projects')) document.getElementById('p-projects').innerText = stats.projects_count;
        if(document.getElementById('p-proposals')) document.getElementById('p-proposals').innerText = stats.proposals_count;
        if(document.getElementById('p-rating')) document.getElementById('p-rating').innerText = stats.avg_rating || "0.0";
    } catch (err) { console.error(err); }
}

function toggleEdit() {
    const view = document.getElementById('profile-view');
    const edit = document.getElementById('profile-edit');
    if (!view || !edit) return;
    if (view.style.display === 'none') {
        view.style.display = 'block';
        edit.style.display = 'none';
    } else {
        view.style.display = 'none';
        edit.style.display = 'block';
    }
}

async function saveProfile() {
    const updatedData = {
        first_name: document.getElementById('edit-fname').value,
        last_name: document.getElementById('edit-lname').value,
        phones: document.getElementById('edit-phones').value.split(',').map(p => p.trim())
    };
    try {
        const res = await fetch(`http://localhost:5000/api/profile/update/${user.user_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedData)
        });
        if (res.ok) {
            user.first_name = updatedData.first_name;
            user.last_name = updatedData.last_name;
            localStorage.setItem('user', JSON.stringify(user));
            alert("Profile updated!");
            loadProfile();
            toggleEdit();
        }
    } catch (err) { console.error(err); }
}

async function deleteAccount() {
    if (!confirm("Are you sure?")) return;
    try {
        const res = await fetch(`http://localhost:5000/api/profile/delete/${user.user_id}`, { method: 'DELETE' });
        if (res.ok) { alert("Deleted."); logout(); }
    } catch (err) { console.error(err); }
}

function logout() {
    localStorage.clear();
    window.location.href = 'index.html';
}

function openProjectModal() {
    document.getElementById('project-modal-overlay').style.display = 'flex';
}

function closeProjectModal() {
    document.getElementById('project-modal-overlay').style.display = 'none';
}

async function populateCategories() {
    try {
        const res = await fetch(`http://localhost:5000/api/categories`);
        const categories = await res.json();
        const selectEl = document.getElementById('p-category');
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="" disabled selected>Select Category...</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.category_id;
            option.innerText = cat.category_name;
            selectEl.appendChild(option);
        });
    } catch (err) { console.error(err); }
}

async function handleProjectSubmit(event) {
    event.preventDefault();
    const projectData = {
        client_id: user.user_id,
        title: document.getElementById('p-title').value,
        category_id: document.getElementById('p-category').value,
        description: document.getElementById('p-desc').value,
        budget: document.getElementById('p-budget').value,
        deadline: document.getElementById('p-deadline').value
    };
    try {
        const res = await fetch(`http://localhost:5000/api/projects/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        if (res.ok) {
            alert("Project posted!");
            closeProjectModal();
            loadMyProjects();
        }
    } catch (err) { console.error(err); }
}

window.onload = () => {
    const browseButton = Array.from(document.querySelectorAll('.nav-item')).find(el => el.textContent === 'Browse');
    loadTab('browse', browseButton);
};

async function loadMyBids() {
    const grid = document.getElementById('bids-grid');
    if (!grid) return;

    try {
        const res = await fetch(`http://localhost:5000/api/proposals/my-bids/${user.user_id}`);
        const bids = await res.json();

        if (bids.length === 0) {
            grid.innerHTML = "<p>You haven't applied for any projects yet.</p>";
            return;
        }

        grid.innerHTML = bids.map(b => `
            <div class="job-card">
                <div class="tag" style="background:#e0f2fe; color:#0369a1;">BID: ₹${b.proposal_amount}</div>
                <h3 class="title-large">${b.title}</h3>
                <div class="tag">${b.category_name}</div>
                <p class="job-desc">${b.description}</p>
                <div class="card-footer" style="margin-top:10px; border-top:1px solid #f1f5f9; padding-top:10px;">
                    <small>Applied on: ${new Date(b.bid_date).toLocaleDateString()}</small>
                    <div style="font-weight:bold; color:${b.status === 'completed' ? '#166534' : '#004aad'}">
                        Status: ${b.status.toUpperCase()}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Error loading bids:", err);
        grid.innerHTML = "<p>Error loading bids.</p>";
    }
}
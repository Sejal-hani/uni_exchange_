const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serve all static files from the frontend folder
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// DATABASE CONNECTION
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'nimit8222', 
    database: 'CampusFreelanceDB'
});

db.connect(err => {
    if (err) {
        console.error("❌ DB Error: " + err.message);
        return;
    }
    console.log("✅ Database Connected Successfully!");
});

// ==========================================
// 1. AUTHENTICATION (Login & Register)
// ==========================================

// REGISTER: Handles User + Multiple Phone Numbers
app.post('/api/register', (req, res) => {
    const { first_name, last_name, email, college_id, password, phone_primary, phone_alt } = req.body;
    
    db.beginTransaction(err => {
        if (err) return res.status(500).json({ message: "Transaction failed" });

        const sqlUser = "INSERT INTO Platform_Users (first_name, last_name, email, college_id, password_hash) VALUES (?, ?, ?, ?, ?)";
        db.query(sqlUser, [first_name, last_name, email, college_id, password], (err, result) => {
            if (err) {
                return db.rollback(() => {
                    if (err.sqlState === '45000') return res.status(400).json({ message: "Only @bmu.edu.in emails allowed!" });
                    res.status(400).json({ message: "Email or College ID already exists" });
                });
            }

            const userId = result.insertId;
            const phoneValues = [];
            if (phone_primary) phoneValues.push([userId, phone_primary]);
            if (phone_alt) phoneValues.push([userId, phone_alt]);

            if (phoneValues.length > 0) {
                const sqlPhone = "INSERT INTO User_Phones (user_id, phone_number) VALUES ?";
                db.query(sqlPhone, [phoneValues], (err) => {
                    if (err) return db.rollback(() => res.status(400).json({ message: "Phone storage failed" }));
                    db.commit(() => res.json({ success: true, message: "User registered with phones!" }));
                });
            } else {
                db.commit(() => res.json({ success: true, message: "User registered!" }));
            }
        });
    });
});

// LOGIN
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.query("SELECT * FROM Platform_Users WHERE email = ? AND password_hash = ?", [email, password], (err, results) => {
        if (err) return res.status(500).json({ message: err.message });
        if (results.length > 0) {
            res.json({ user: results[0] });
        } else {
            res.status(401).json({ message: "Invalid email or password" });
        }
    });
});

// ==========================================
// 2. PROJECTS (Browse, My Projects, Create, Status)
// ==========================================

// BROWSE: Others' open projects (Checks if user has applied)
app.get('/api/projects/others/:id', (req, res) => {
    const userId = req.params.id;
    const sql = `
        SELECT p.*, c.category_name, u.first_name,
        (SELECT COUNT(*) FROM Proposals WHERE project_id = p.project_id AND freelancer_id = ?) as has_applied
        FROM Projects p 
        JOIN Project_Categories c ON p.category_id = c.category_id 
        JOIN Platform_Users u ON p.client_id = u.user_id 
        WHERE p.client_id != ? AND p.status = 'open' 
        ORDER BY p.created_at DESC`;
        
    db.query(sql, [userId, userId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// MY PROJECTS: Projects I have posted
app.get('/api/projects/my/:id', (req, res) => {
    const sql = `
        SELECT p.*, c.category_name 
        FROM Projects p 
        JOIN Project_Categories c ON p.category_id = c.category_id 
        WHERE p.client_id = ? 
        ORDER BY p.created_at DESC`;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// CREATE PROJECT
app.post('/api/projects/create', (req, res) => {
    const { client_id, category_id, title, description, budget, deadline } = req.body;
    const sql = "INSERT INTO Projects (client_id, category_id, title, description, budget, deadline) VALUES (?, ?, ?, ?, ?, ?)";
    db.query(sql, [client_id, category_id, title, description, budget, deadline], (err) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

// ACCEPT A PROPOSAL (Moves project to 'in_progress')
app.post('/api/projects/accept', (req, res) => {
    const { project_id } = req.body;
    db.query("UPDATE Projects SET status = 'in_progress' WHERE project_id = ?", [project_id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// MARK PROJECT AS COMPLETED
app.post('/api/projects/complete', (req, res) => {
    const { project_id } = req.body;
    db.query("UPDATE Projects SET status = 'completed' WHERE project_id = ?", [project_id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// ==========================================
// 3. WALLET & TRANSACTIONS
// ==========================================

// WALLET BALANCE
app.get('/api/wallet/:id', (req, res) => {
    db.query("SELECT balance FROM User_Wallets WHERE user_id = ?", [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results[0] || { balance: 0 });
    });
});

// TRANSACTION HISTORY
app.get('/api/wallet/history/:id', (req, res) => {
    const sql = `
        SELECT t.* 
        FROM Wallet_Transactions t 
        JOIN User_Wallets w ON t.wallet_id = w.wallet_id 
        WHERE w.user_id = ? 
        ORDER BY t.created_at DESC`;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ==========================================
// 4. PROFILE, CATEGORIES & SETTINGS
// ==========================================

// GET PROFILE PHONES
app.get('/api/profile/phones/:id', (req, res) => {
    db.query("SELECT phone_number FROM User_Phones WHERE user_id = ?", [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json({ phones: results.map(r => r.phone_number) });
    });
});

// UPDATE PROFILE
app.put('/api/profile/update/:id', (req, res) => {
    const userId = req.params.id;
    const { first_name, last_name, phones } = req.body;

    db.beginTransaction(err => {
        if (err) return res.status(500).json({ message: "Update failed" });
        const sqlUser = "UPDATE Platform_Users SET first_name = ?, last_name = ? WHERE user_id = ?";
        db.query(sqlUser, [first_name, last_name, userId], (err) => {
            if (err) return db.rollback(() => res.status(400).json({ message: err.message }));
            db.query("DELETE FROM User_Phones WHERE user_id = ?", [userId], (err) => {
                if (err) return db.rollback(() => res.status(400).json({ message: "Phone update failed" }));
                const phoneValues = phones.filter(p => p.trim() !== "").map(p => [userId, p]);
                if (phoneValues.length > 0) {
                    db.query("INSERT INTO User_Phones (user_id, phone_number) VALUES ?", [phoneValues], (err) => {
                        if (err) return db.rollback(() => res.status(400).json({ message: "Phone insertion failed" }));
                        db.commit(() => res.json({ success: true }));
                    });
                } else {
                    db.commit(() => res.json({ success: true }));
                }
            });
        });
    });
});

// GET PROFILE STATS
app.get('/api/profile/stats/:id', (req, res) => {
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM Projects WHERE client_id = ?) as projects_count,
            (SELECT COUNT(*) FROM Proposals WHERE freelancer_id = ?) as proposals_count,
            (SELECT ROUND(AVG(rating), 1) FROM Reviews WHERE reviewee_id = ?) as avg_rating
    `;
    db.query(sql, [req.params.id, req.params.id, req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results[0]);
    });
});

// DELETE ACCOUNT
app.delete('/api/profile/delete/:id', (req, res) => {
    db.query("DELETE FROM Platform_Users WHERE user_id = ?", [req.params.id], (err, result) => {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ success: true });
    });
});

// GET CATEGORIES
app.get('/api/categories', (req, res) => {
    db.query("SELECT * FROM Project_Categories", (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// ==========================================
// 5. PROPOSALS (Bids & My Applications)
// ==========================================

// APPLY / BID FOR A PROJECT
app.post('/api/proposals/apply', (req, res) => {
    const { project_id, freelancer_id, amount } = req.body;
    const sql = "INSERT INTO Proposals (project_id, freelancer_id, proposal_amount) VALUES (?, ?, ?)";
    db.query(sql, [project_id, freelancer_id, amount], (err) => {
        if (err) return res.status(400).json({ message: err.message });
        res.json({ success: true });
    });
});

// GET PROPOSALS FOR A SPECIFIC PROJECT (Client sees bidders)
app.get('/api/proposals/project/:id', (req, res) => {
    const sql = `
        SELECT p.*, u.first_name, u.last_name, u.email 
        FROM Proposals p 
        JOIN Platform_Users u ON p.freelancer_id = u.user_id 
        WHERE p.project_id = ? 
        ORDER BY p.created_at DESC`;
    db.query(sql, [req.params.id], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// GET MY BIDS (Freelancer sees what they applied for)
app.get('/api/proposals/my-bids/:id', (req, res) => {
    const freelancerId = req.params.id;
    const sql = `
        SELECT p.*, c.category_name, prop.proposal_amount, prop.created_at AS bid_date
        FROM Proposals prop
        JOIN Projects p ON prop.project_id = p.project_id
        JOIN Project_Categories c ON p.category_id = c.category_id
        WHERE prop.freelancer_id = ?
        ORDER BY prop.created_at DESC`;
    
    db.query(sql, [freelancerId], (err, results) => {
        if (err) return res.status(500).json(err);
        res.json(results);
    });
});

// SERVER START
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Uni Exchange Server running on http://localhost:${PORT}`);
});
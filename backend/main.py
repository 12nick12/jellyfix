from fastapi import FastAPI, BackgroundTasks
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import datetime
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# --- CONFIGURATION (Variables d'environnement) ---
ROOT_PATH = os.getenv("ROOT_PATH", "/jellyfix")
LANG = os.getenv("LANGUAGE", "EN").upper()  # EN ou FR

# Sécurité Dashboard
ADMIN_ID = os.getenv("JELLYFIN_ADMIN_ID", "")

# Configuration SMTP
SMTP_SERVER = os.getenv("SMTP_SERVER", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
EMAIL_FROM = os.getenv("EMAIL_FROM", SMTP_USER)
EMAIL_TO = os.getenv("EMAIL_TO", SMTP_USER)

# Initialisation FastAPI
app = FastAPI(root_path=ROOT_PATH)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_FILE = "tickets.db"

# --- TEXTES & TRADUCTIONS ---
TEXTS = {
    "EN": {
        "email_subject": "🚨 Jellyfin Ticket #{id}: {item}",
        "email_title": "New Issue Reported",
        "email_user": "User",
        "email_media": "Media",
        "email_issue": "Issue",
        "email_msg": "Message",
        "email_footer": "Log in to Jellyfin to manage this ticket.",
        "dash_title": "JellyFix Admin",
        "dash_empty": "No tickets yet. All good! 🎉",
        "lbl_status": "Status:",
        "lbl_new": "New",
        "lbl_wip": "In Progress",
        "lbl_done": "Resolved",
        "lbl_view": "View Media",
        "err_access": "⛔ Access Denied"
    },
    "FR": {
        "email_subject": "🚨 Ticket Jellyfin #{id} : {item}",
        "email_title": "Nouveau Signalement",
        "email_user": "Utilisateur",
        "email_media": "Média",
        "email_issue": "Problème",
        "email_msg": "Message",
        "email_footer": "Connectez-vous à Jellyfin pour gérer ce ticket.",
        "dash_title": "Administration JellyFix",
        "dash_empty": "Aucun ticket pour le moment. Tout va bien ! 🎉",
        "lbl_status": "Statut :",
        "lbl_new": "Nouveau",
        "lbl_wip": "En cours",
        "lbl_done": "Résolu",
        "lbl_view": "Voir le média",
        "err_access": "⛔ Accès Interdit"
    }
}
T = TEXTS.get(LANG, TEXTS["EN"])

# --- BASE DE DONNEES ---
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS tickets
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  jellyfin_item_id TEXT,
                  item_name TEXT,
                  issue_type TEXT,
                  status TEXT DEFAULT 'new',
                  created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS comments
                 (id INTEGER PRIMARY KEY AUTOINCREMENT,
                  ticket_id INTEGER,
                  user TEXT,
                  message TEXT,
                  created_at TEXT,
                  is_admin BOOLEAN DEFAULT 0)''')
    conn.commit()
    conn.close()

init_db()

# --- NOTIFICATION EMAIL ---
def send_email_notification(ticket_id, item_name, issue, comment, user):
    if not SMTP_USER or not SMTP_PASSWORD:
        print("⚠️ Email not configured, skipping notification.")
        return

    try:
        subject = T["email_subject"].format(id=ticket_id, item=item_name)
        
        body = f"""
        <html>
          <body style="font-family: Arial, sans-serif; color: #333;">
            <div style="background-color: #00a4dc; color: white; padding: 10px;">
              <h2 style="margin:0;">{T['email_title']}</h2>
            </div>
            <div style="padding: 20px; border: 1px solid #ddd;">
              <p><strong>👤 {T['email_user']} :</strong> {user}</p>
              <p><strong>🎬 {T['email_media']} :</strong> {item_name}</p>
              <p><strong>⚠️ {T['email_issue']} :</strong> {issue}</p>
              <p><strong>💬 {T['email_msg']} :</strong><br>"{comment}"</p>
              <hr>
              <p>{T['email_footer']}</p>
            </div>
          </body>
        </html>
        """

        msg = MIMEMultipart()
        msg['From'] = EMAIL_FROM
        msg['To'] = EMAIL_TO
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        print(f"📧 Connecting to SMTP {SMTP_SERVER}:{SMTP_PORT}...")
        
        if SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT)
        else:
            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()

        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)
        server.quit()
        print(f"✅ Email sent for ticket #{ticket_id}")
        
    except Exception as e:
        print(f"❌ Error sending email: {str(e)}")

# --- MODELES API ---
class TicketCreate(BaseModel):
    jellyfin_item_id: str
    item_name: str
    issue_type: str
    initial_comment: str
    user: str

class CommentCreate(BaseModel):
    ticket_id: int
    user: str
    message: str

class StatusUpdate(BaseModel):
    status: str

# --- ROUTES API ---

@app.get("/status/{item_id}")
def get_ticket_status(item_id: str):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM tickets WHERE jellyfin_item_id = ? AND status != 'resolved' ORDER BY id DESC LIMIT 1", (item_id,))
    ticket = c.fetchone()
    conn.close()
    if ticket: return dict(ticket)
    return {"status": "none"}

@app.post("/tickets")
def create_ticket(t: TicketCreate, background_tasks: BackgroundTasks):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    now = datetime.datetime.now().isoformat()
    c.execute("INSERT INTO tickets (jellyfin_item_id, item_name, issue_type, status, created_at) VALUES (?, ?, ?, 'new', ?)",
              (t.jellyfin_item_id, t.item_name, t.issue_type, now))
    ticket_id = c.lastrowid
    c.execute("INSERT INTO comments (ticket_id, user, message, created_at) VALUES (?, ?, ?, ?)",
              (ticket_id, t.user, t.initial_comment, now))
    conn.commit()
    conn.close()
    
    background_tasks.add_task(send_email_notification, ticket_id, t.item_name, t.issue_type, t.initial_comment, t.user)
    
    return {"id": ticket_id, "status": "success"}

@app.get("/tickets/{ticket_id}")
def get_ticket_details(ticket_id: int):
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,))
    ticket = c.fetchone()
    c.execute("SELECT * FROM comments WHERE ticket_id = ? ORDER BY id ASC", (ticket_id,))
    comments = c.fetchall()
    conn.close()
    return {"ticket": dict(ticket), "comments": [dict(row) for row in comments]}

@app.post("/comments")
def add_comment(c: CommentCreate):
    conn = sqlite3.connect(DB_FILE)
    cur = conn.cursor()
    now = datetime.datetime.now().isoformat()
    # Simple admin check based on username "Admin" or if provided/handled by frontend
    is_admin = 1 if c.user == "Admin" else 0
    cur.execute("INSERT INTO comments (ticket_id, user, message, created_at, is_admin) VALUES (?, ?, ?, ?, ?)",
                (c.ticket_id, c.user, c.message, now, is_admin))
    conn.commit()
    conn.close()
    return {"status": "added"}

@app.put("/tickets/{ticket_id}/status")
def update_status(ticket_id: int, update: StatusUpdate):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("UPDATE tickets SET status = ? WHERE id = ?", (update.status, ticket_id))
    conn.commit()
    conn.close()
    return {"status": "updated"}

@app.get("/all_tickets")
def get_all_tickets():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    # Order by status (New > In Progress > Resolved) then date
    c.execute("SELECT * FROM tickets ORDER BY CASE status WHEN 'new' THEN 1 WHEN 'in_progress' THEN 2 ELSE 3 END, id DESC")
    tickets = c.fetchall()
    conn.close()
    return [dict(row) for row in tickets]

# --- DASHBOARD ADMIN ---
@app.get("/admin", response_class=HTMLResponse)
def admin_dashboard():
    # Injection des variables python dans le JS
    html_content = f"""
    <!DOCTYPE html>
    <html lang="{LANG.lower()}">
    <head>
        <title>{T['dash_title']}</title>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
        <style>
            body {{ background: #101010; color: #eee; font-family: sans-serif; padding: 20px; max-width: 1000px; margin: auto; display:none; }}
            h1 {{ color: #00a4dc; border-bottom: 2px solid #333; padding-bottom: 15px; display: flex; align-items: center; gap: 10px; }}
            .ticket-card {{ background: #202020; border: 1px solid #333; padding: 20px; margin-bottom: 15px; border-radius: 8px; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.3); }}
            .ticket-info {{ flex: 1; min-width: 300px; }}
            .ticket-info h3 {{ margin: 0 0 10px 0; font-size: 1.2em; color: #fff; }}
            .ticket-meta {{ color: #aaa; font-size: 0.95em; line-height: 1.6; }}
            .ticket-id {{ font-size: 0.8em; opacity: 0.5; margin-left: 10px; }}
            .status-control {{ display: flex; flex-direction: column; gap: 10px; min-width: 150px; }}
            select {{ padding: 10px; border-radius: 5px; background: #000; color: #fff; border: 1px solid #444; cursor: pointer; font-size: 1em; }}
            .badge-new {{ border-left: 5px solid #ff4444; }}
            .badge-in_progress {{ border-left: 5px solid #ffbb33; }}
            .badge-resolved {{ border-left: 5px solid #00C851; opacity: 0.7; }}
            .btn-link {{ color: #00a4dc; text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 5px; margin-top: 10px; }}
            .btn-link:hover {{ text-decoration: underline; }}
            .empty-state {{ text-align: center; padding: 50px; color: #666; font-style: italic; }}
        </style>
        <script>
            // Security: Check if user is admin via Jellyfin LocalStorage
            const EXPECTED_ADMIN_ID = "{ADMIN_ID}"; 
            
            function checkAuth() {{
                try {{
                    const storedCreds = localStorage.getItem('jellyfin_credentials');
                    if (!storedCreds) throw "Not logged in";
                    const parsed = JSON.parse(storedCreds);
                    if (!parsed.Servers || parsed.Servers.length === 0) throw "No server found";
                    
                    const userId = parsed.Servers[0].UserId;
                    // If ADMIN_ID is set in env vars, enforce it
                    if (EXPECTED_ADMIN_ID && userId !== EXPECTED_ADMIN_ID) {{
                        document.write("<h1 style='color:white;text-align:center;margin-top:20%'>{T['err_access']}</h1>");
                        throw "Wrong User";
                    }}
                    // Auth OK
                    document.body.style.display = "block";
                }} catch(e) {{
                    // Redirect to Jellyfin home if not auth
                    window.location.href = "/web/index.html"; 
                }}
            }}
        </script>
    </head>
    <body onload="checkAuth()">
        <h1><span class="material-icons" style="font-size:36px">build</span> {T['dash_title']}</h1>
        <div id="ticket-list">Loading...</div>

        <script>
            // Detect API root path automatically
            const API_ROOT = window.location.pathname.replace('/admin', ''); 

            async function loadTickets() {{
                try {{
                    const res = await fetch(API_ROOT + "/all_tickets");
                    const tickets = await res.json();
                    const container = document.getElementById('ticket-list');
                    
                    if(tickets.length === 0) {{
                        container.innerHTML = '<div class="empty-state">{T['dash_empty']}</div>';
                        return;
                    }}

                    container.innerHTML = "";

                    tickets.forEach(t => {{
                        const date = new Date(t.created_at).toLocaleString();
                        
                        const div = document.createElement('div');
                        div.className = `ticket-card badge-${{t.status}}`;
                        div.innerHTML = `
                            <div class="ticket-info">
                                <h3>${{t.item_name}} <span class="ticket-id">#${{t.id}}</span></h3>
                                <div class="ticket-meta">
                                    <div><strong>👤 {T['email_user']} :</strong> ${{t.user || 'Unknown'}}</div>
                                    <div><strong>⚠️ {T['email_issue']} :</strong> ${{t.issue_type}}</div>
                                    <div><strong>📅 Date :</strong> ${{date}}</div>
                                    <a href="/web/index.html#!/details?id=${{t.jellyfin_item_id}}" target="_blank" class="btn-link">
                                        <span class="material-icons" style="font-size:16px">open_in_new</span> {T['lbl_view']}
                                    </a>
                                </div>
                            </div>
                            <div class="status-control">
                                <label style="font-size:0.8em; color:#888;">{T['lbl_status']}</label>
                                <select onchange="updateStatus(${{t.id}}, this.value)">
                                    <option value="new" ${{t.status === 'new' ? 'selected' : ''}}>🔴 {T['lbl_new']}</option>
                                    <option value="in_progress" ${{t.status === 'in_progress' ? 'selected' : ''}}>🟠 {T['lbl_wip']}</option>
                                    <option value="resolved" ${{t.status === 'resolved' ? 'selected' : ''}}>🟢 {T['lbl_done']}</option>
                                </select>
                            </div>
                        `;
                        container.appendChild(div);
                    }});
                }} catch(e) {{
                    document.getElementById('ticket-list').innerHTML = "Error loading tickets: " + e;
                }}
            }}

            async function updateStatus(id, newStatus) {{
                await fetch(API_ROOT + `/tickets/${{id}}/status`, {{
                    method: 'PUT',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{status: newStatus}})
                }});
                loadTickets();
            }}

            loadTickets();
            setInterval(loadTickets, 30000); // Auto-refresh
        </script>
    </body>
    </html>
    """
    return html_content

/**
 * ====================================================================
 * 🎟️ JELLYFIX - TICKET SYSTEM INJECTOR
 * ====================================================================
 * * INSTRUCTIONS:
 * 1. Open your Jellyfin 'index.html' file (usually in /usr/share/jellyfin/web/).
 * 2. Paste this entire script just before the closing </body> tag.
 * 3. Edit the CONFIG section below with your server details.
 * 4. Save and clear your browser cache.
 */

(function() {
    // ============================================
    // ⚙️ CONFIGURATION (EDIT THIS)
    // ============================================
    const CONFIG = {
        // Public URL of your JellyFix backend
        // If hosted on the same domain/IP, you can often keep window.location.origin
        // Example: "https://my-jellyfin.com/jellyfix"
        apiUrl: window.location.origin + "/jellyfix", 
        
        // YOUR Jellyfin Admin User ID
        // Find it in Dashboard > Users > (Your Profile) > The ID is in the browser URL
        adminId: "REPLACE_WITH_YOUR_ADMIN_ID_HERE" 
    };

    // --- LANGUAGE & TEXTS (English Default) ---
    const T = {
        btn_report: "Report Issue",
        btn_new: "Open Ticket",
        btn_wip: "In Progress",
        btn_done: "Resolved",
        menu_admin: "Ticket Manager",
        modal_title: "Report an Issue",
        label_user: "Your Username:",
        label_issue: "Issue Type:",
        label_desc: "Details:",
        ph_user: "Jellyfin Username",
        ph_desc: "Describe the problem (sound, subs, quality...)",
        btn_send: "Send Report",
        alert_user: "Please enter your username!",
        alert_desc: "Please provide a description.",
        alert_sent: "Report sent successfully!",
        err_tech: "Technical Error: ",
        chat_admin: "Admin",
        chat_you: "You",
        chat_user: "User",
        status_wip: "🔧 Set to In Progress",
        status_close: "✅ Close Ticket",
        msg_resolved: "This ticket is resolved 🎉",
        // Issue types dropdown
        options: [
            "Audio Sync / No Audio",
            "Missing / Bad Subtitles",
            "Video Quality / Glitch",
            "Wrong Language",
            "Other"
        ]
    };

    // ============================================
    // 🎨 STYLES (Injected dynamically)
    // ============================================
    function injectStyles() {
        const css = `
            #jellyfix-overlay { display: none; position: fixed; z-index: 10000; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.85); backdrop-filter: blur(5px); align-items: center; justify-content: center; }
            .jellyfix-modal { background-color: #181818; color: #fff; width: 90%; max-width: 600px; height: 80vh; border-radius: 12px; border: 1px solid #333; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.7); font-family: sans-serif; }
            .jellyfix-header { padding: 15px 20px; background: #202020; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
            .jellyfix-header h2 { margin: 0; font-size: 1.2em; color: #00a4dc; }
            .jellyfix-close { background: none; border: none; color: #aaa; cursor: pointer; font-size: 1.5em; }
            .jellyfix-body { flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; }
            .admin-actions { display: flex; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 1px solid #333; justify-content: center; }
            .btn-status { padding: 8px 15px; border-radius: 5px; border: none; color: white; font-weight: bold; cursor: pointer; font-size: 0.9em; }
            .btn-work { background-color: #ffbb33; color: #000; }
            .btn-close { background-color: #00C851; }
            .btn-work:hover { background-color: #ffaa00; }
            .btn-close:hover { background-color: #007E33; }
            .chat-message { margin-bottom: 15px; padding: 10px 15px; border-radius: 10px; max-width: 80%; line-height: 1.4; font-size: 0.95em; position: relative; }
            .msg-user { align-self: flex-start; background: #333; color: #ddd; border-bottom-left-radius: 2px; }
            .msg-admin { align-self: flex-end; background: #00a4dc; color: #fff; border-bottom-right-radius: 2px; }
            .msg-meta { font-size: 0.7em; opacity: 0.6; margin-bottom: 4px; display: block; }
            .jellyfix-footer { padding: 15px; background: #202020; border-top: 1px solid #333; display: flex; gap: 10px; }
            .jellyfix-input { flex: 1; padding: 10px; border-radius: 20px; border: 1px solid #444; background: #101010; color: white; resize: none; height: 40px; font-family: inherit; }
            .jellyfix-btn { background: #00a4dc; color: white; border: none; padding: 0 20px; border-radius: 20px; cursor: pointer; font-weight: bold; transition: background 0.2s; }
            .jellyfix-btn:hover { background: #0085b2; }
            .jellyfix-btn:disabled { opacity: 0.5; cursor: wait; }
            #btn-jellyfix { margin-right: 0.5em; display: flex; align-items: center; justify-content: center; }
            .jf-badge-new { color: #ff4444 !important; }
            .jf-badge-work { color: #ffbb33 !important; }
            .jf-badge-ok { color: #00C851 !important; }
            @keyframes pulse-red { 0% { opacity: 1; } 50% { opacity: 0.6; } 100% { opacity: 1; } }
            .pulsing { animation: pulse-red 2s infinite; }
            .form-group { margin-bottom: 15px; }
            .form-group label { display: block; margin-bottom: 5px; color: #ccc; }
            .form-group select, .form-group textarea, .form-group input { width: 100%; padding: 10px; background: #101010; border: 1px solid #444; color: white; border-radius: 5px; box-sizing: border-box; }
            /* Hover effects for injected buttons */
            #btn-admin-tickets:hover, #btn-jellyfix:hover { background: var(--theme-primary-color, #00a4dc) !important; color: #fff !important; }
        `;
        const style = document.createElement('style');
        style.innerText = css;
        document.head.appendChild(style);
    }

    // ============================================
    // 🧠 LOGIC
    // ============================================
    
    let currentTicketId = null;
    let currentItemId = null;
    let currentItemName = "";

    // Helper: Get robust user info from Jellyfin
    function getCurrentUser() {
        try {
            // Method 1: LocalStorage (Most reliable for persistent ID)
            const storedCreds = localStorage.getItem('jellyfin_credentials');
            if (storedCreds) {
                const parsed = JSON.parse(storedCreds);
                if (parsed.Servers && parsed.Servers.length > 0) {
                    return { name: "User", id: parsed.Servers[0].UserId };
                }
            }
            // Method 2: Global ApiClient
            if (window.ApiClient && window.ApiClient.currentUser) {
                 if (typeof window.ApiClient.currentUser === 'object') {
                     return { name: window.ApiClient.currentUser.Name, id: window.ApiClient.currentUser.Id };
                 }
                 if (typeof window.ApiClient.currentUser === 'function') {
                     const u = window.ApiClient.currentUser();
                     return { name: u.Name, id: u.Id };
                 }
            }
        } catch (e) {}
        return { name: "", id: null };
    }

    // Helper: Get user's nickname via API
    function getUserName(fallback) {
        try {
            if(window.ApiClient && typeof window.ApiClient.currentUser === 'function') {
                return window.ApiClient.currentUser().Name;
            }
        } catch(e) {}
        return fallback;
    }

    async function checkStatus(itemId) {
        try {
            const res = await fetch(`${CONFIG.apiUrl}/status/${itemId}`);
            if (!res.ok) throw new Error("HTTP " + res.status);
            return await res.json();
        } catch (e) { return null; }
    }

    async function fetchTicketDetails(ticketId) {
        const res = await fetch(`${CONFIG.apiUrl}/tickets/${ticketId}`);
        return await res.json();
    }

    async function createTicket(data) {
        const res = await fetch(`${CONFIG.apiUrl}/tickets`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    }

    async function sendMessage(ticketId, msg) {
        const user = getCurrentUser();
        // Use user's real name if possible, otherwise generic
        const name = getUserName(T.chat_user); 
        const senderName = (user.id === CONFIG.adminId) ? T.chat_admin : name;

        await fetch(`${CONFIG.apiUrl}/comments`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                ticket_id: ticketId,
                user: senderName, 
                message: msg
            })
        });
    }

    async function updateTicketStatus(ticketId, newStatus) {
        await fetch(`${CONFIG.apiUrl}/tickets/${ticketId}/status`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({status: newStatus})
        });
    }

    // UI: Modal Management
    function createModalStructure() {
        if(document.getElementById('jellyfix-overlay')) return;
        const div = document.createElement('div');
        div.id = 'jellyfix-overlay';
        div.innerHTML = `
          <div class="jellyfix-modal">
            <div class="jellyfix-header">
              <h2 id="jf-title">Ticket</h2>
              <button class="jellyfix-close">×</button>
            </div>
            <div id="jf-content" class="jellyfix-body"></div>
            <div id="jf-footer" class="jellyfix-footer" style="display:none;">
              <textarea id="jf-chat-input" class="jellyfix-input" placeholder="..."></textarea>
              <button id="jf-chat-send" class="jellyfix-btn">${T.btn_send}</button>
            </div>
          </div>
        `;
        document.body.appendChild(div);
        
        div.querySelector('.jellyfix-close').onclick = () => {
            div.style.display = 'none';
            refreshButton();
        };
    }

    function showCreateForm() {
        const content = document.getElementById('jf-content');
        document.getElementById('jf-footer').style.display = 'none';
        document.getElementById('jf-title').innerText = T.modal_title + currentItemName;
        
        const prefilledName = getUserName("");

        let optionsHtml = T.options.map(o => `<option>${o}</option>`).join('');

        content.innerHTML = `
            <div class="form-group">
                <label>${T.label_user}</label>
                <input type="text" id="new-issue-user" value="${prefilledName}" placeholder="${T.ph_user}">
            </div>
            <div class="form-group">
                <label>${T.label_issue}</label>
                <select id="new-issue-type">${optionsHtml}</select>
            </div>
            <div class="form-group">
                <label>${T.label_desc}</label>
                <textarea id="new-issue-desc" rows="4" placeholder="${T.ph_desc}"></textarea>
            </div>
            <button id="btn-submit-ticket" class="jellyfix-btn" style="width:100%; margin-top:10px;">${T.btn_send}</button>
        `;

        document.getElementById('btn-submit-ticket').onclick = async function() {
            const btn = this;
            const userNameInput = document.getElementById('new-issue-user').value;
            const type = document.getElementById('new-issue-type').value;
            const desc = document.getElementById('new-issue-desc').value;
            
            if(!userNameInput) return alert(T.alert_user);
            if(!desc) return alert(T.alert_desc);
            
            btn.innerText = "..."; btn.disabled = true;

            try {
                await createTicket({
                    jellyfin_item_id: currentItemId,
                    item_name: currentItemName,
                    issue_type: type,
                    initial_comment: desc,
                    user: userNameInput
                });
                alert(T.alert_sent);
                document.getElementById('jellyfix-overlay').style.display = 'none';
                refreshButton();
            } catch(e) {
                console.error(e);
                alert(T.err_tech + e.message);
                btn.disabled = false;
                btn.innerText = T.btn_send;
            }
        };
    }

    async function showChat(ticketId) {
        currentTicketId = ticketId;
        const data = await fetchTicketDetails(ticketId);
        const ticket = data.ticket;
        const comments = data.comments;
        const user = getCurrentUser();
        const isAdmin = (user.id === CONFIG.adminId);

        document.getElementById('jf-title').innerText = `Ticket #${ticket.id}`;
        document.getElementById('jf-footer').style.display = 'flex'; 
        
        const content = document.getElementById('jf-content');
        content.innerHTML = ""; 

        if (isAdmin && ticket.status !== 'resolved') {
            let actionsHtml = '<div class="admin-actions">';
            if (ticket.status === 'new') {
                actionsHtml += `<button class="btn-status btn-work" data-status="in_progress">${T.status_wip}</button>`;
            }
            actionsHtml += `<button class="btn-status btn-close" data-status="resolved">${T.status_close}</button>`;
            actionsHtml += '</div>';
            content.innerHTML += actionsHtml;
            
            // Bind action buttons
            content.querySelectorAll('.btn-status').forEach(b => {
                b.onclick = async () => {
                    if(!confirm("Confirm?")) return;
                    await updateTicketStatus(currentTicketId, b.dataset.status);
                    showChat(currentTicketId);
                };
            });
        } else if (ticket.status === 'resolved') {
            content.innerHTML += `<div style="text-align:center; color:#00C851; margin-bottom:15px;"><strong>${T.msg_resolved}</strong></div>`;
        }

        comments.forEach(c => {
            const isMsgAdmin = c.is_admin || c.user === "Admin" || c.user === T.chat_admin; 
            const cssClass = isMsgAdmin ? 'msg-admin' : 'msg-user';
            const dateStr = new Date(c.created_at).toLocaleTimeString();
            content.innerHTML += `
                <div class="chat-message ${cssClass}">
                    <span class="msg-meta">${c.user} - ${dateStr}</span>
                    ${c.message}
                </div>
            `;
        });
        content.scrollTop = content.scrollHeight;

        document.getElementById('jf-chat-send').onclick = async function() {
            const input = document.getElementById('jf-chat-input');
            const txt = input.value;
            if(!txt) return;
            input.value = "";
            
            const senderName = isAdmin ? T.chat_admin : T.chat_you;
            const css = isAdmin ? 'msg-admin' : 'msg-user';
            content.innerHTML += `<div class="chat-message ${css}"><span class="msg-meta">${senderName}</span>${txt}</div>`;
            content.scrollTop = content.scrollHeight;
            await sendMessage(ticketId, txt);
        };
    }

    // --- BUTTON INJECTION ---
    function injectAdminMenu() {
        const user = getCurrentUser();
        if (user.id !== CONFIG.adminId) return;
        if(document.getElementById('btn-admin-tickets')) return;

        // Try to find the dashboard link to insert after
        const dashboardLink = document.querySelector('a[href*="dashboard"]');
        const link = document.createElement('a');
        link.id = 'btn-admin-tickets';
        link.href = CONFIG.apiUrl + '/admin';
        link.target = '_blank';
        link.className = 'navMenuOption emby-button';
        link.style.cssText = "margin-top: 5px;"; 
        link.innerHTML = `
            <span class="navMenuOptionIcon material-icons" aria-hidden="true" style="margin-right:1em;">build</span>
            <span class="navMenuOptionText">${T.menu_admin}</span>
        `;
        
        if (dashboardLink && dashboardLink.parentNode) {
            dashboardLink.parentNode.insertBefore(link, dashboardLink.nextSibling);
        } else {
            const sidebar = document.querySelector('.mainDrawer-content') || document.querySelector('.mainDrawer-scrollContainer');
            if(sidebar) sidebar.appendChild(link);
        }
    }

    async function refreshButton() {
        injectAdminMenu(); 

        const container = document.querySelector('.mainDetailButtons');
        if (!container) return;

        const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
        const idFromUrl = urlParams.get('id');
        if(!idFromUrl) return; 
        
        currentItemId = idFromUrl;
        const titleEl = document.querySelector('.itemName') || document.querySelector('.parentName');
        currentItemName = titleEl ? titleEl.innerText : "Media";

        const statusData = await checkStatus(currentItemId);
        
        const oldBtn = document.getElementById('btn-jellyfix');
        if(oldBtn) oldBtn.remove();

        const btn = document.createElement('button');
        btn.id = 'btn-jellyfix';
        btn.className = 'itemsDetailButton emby-button button-flat detailButton';
        btn.type = 'button';
        
        if (statusData && statusData.status !== 'none') {
            let iconColorClass = "";
            let iconName = "confirmation_number"; 
            if(statusData.status === 'new') {
                iconColorClass = "jf-badge-new pulsing";
                btn.title = T.btn_new;
                iconName = "error"; 
            } else if(statusData.status === 'in_progress') {
                iconColorClass = "jf-badge-work";
                btn.title = T.btn_wip;
                iconName = "build"; 
            } else if(statusData.status === 'resolved') {
                iconColorClass = "jf-badge-ok";
                btn.title = T.btn_done;
                iconName = "check_circle";
            }
            btn.innerHTML = `<span class="material-icons detailButton-icon ${iconColorClass}">${iconName}</span>`;
            btn.onclick = function() {
                document.getElementById('jellyfix-overlay').style.display = 'flex';
                showChat(statusData.id);
            };
        } else {
            btn.title = T.btn_report;
            btn.innerHTML = '<span class="material-icons detailButton-icon">flag</span>';
            btn.onclick = function() {
                document.getElementById('jellyfix-overlay').style.display = 'flex';
                showCreateForm();
            };
        }

        const allButtons = container.querySelectorAll('button');
        let moreBtn = null;
        for (const b of allButtons) {
            if (b.innerHTML.includes('more_vert')) { moreBtn = b; break; }
        }
        if (moreBtn) container.insertBefore(btn, moreBtn);
        else container.appendChild(btn);
    }

    // --- INITIALIZATION ---
    injectStyles();
    createModalStructure();

    let lastUrl = location.href; 
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) { lastUrl = url; setTimeout(refreshButton, 500); }
        if(!document.getElementById('btn-jellyfix') && document.querySelector('.mainDetailButtons')) {
            refreshButton();
        }
        injectAdminMenu(); 
    }).observe(document, {subtree: true, childList: true});

    setTimeout(refreshButton, 1000);
})();

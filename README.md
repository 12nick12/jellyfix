# 🎟️ JellyFix - Integrated Ticket System for Jellyfin

**JellyFix** adds a seamless "Report Issue" button directly into your Jellyfin web interface.
Your users can easily report audio/video issues, missing subtitles, or request content. You receive instant email notifications and can manage tickets through a secure, integrated Admin Dashboard.

## ✨ Features

* 🛎️ **Integrated Button**: Automatically appears on movie and series detail pages.
* 📝 **Simple Report Form**: Users can select an issue type and describe the problem.
* 📧 **Email Notifications**: Admins get alerted instantly via SMTP when a ticket is created.
* 💬 **Live Chat**: Discuss the issue with the user directly within the ticket interface.
* 👑 **Admin Dashboard**: A secure interface to manage, filter, and update ticket statuses (New, In Progress, Resolved).
* 🌍 **Multi-Language**: Ready-to-use in English and French.
* 🚀 **Lightweight**: Built with Python (FastAPI), SQLite, and Vanilla JS (Zero dependencies for the frontend).

---

## 🛠️ Installation

### 1. Backend Setup (Docker)

1.  **Clone this repository**:
    ```bash
    git clone https://github.com/Sandoiitchisan/jellyfix.git
    cd jellyfix
    ```

2.  **Configure environment**:
    Copy the example file and edit it with your settings.
    ```bash
    cp .env.example .env
    nano .env
    ```
    *Make sure to fill in your SMTP settings and your `JELLYFIN_ADMIN_ID` (required for dashboard security).*

3.  **Start the container**:
    ```bash
    docker-compose up -d --build
    ```

### 2. Reverse Proxy Configuration (Recommended)

To avoid CORS issues and Mixed Content errors (if your Jellyfin is HTTPS), it is highly recommended to serve JellyFix via your reverse proxy under a subpath (e.g., `/jellyfix`) on the same domain as Jellyfin.

#### Caddy Example

```caddy
your-jellyfin-domain.com {
    # Main Jellyfin Instance
    reverse_proxy 127.0.0.1:8096

    # JellyFix Backend
    handle_path /jellyfix/* {
        reverse_proxy jellyfix:8000
    }
}
```

#### Nginx example

```Nginx
location /jellyfix/ {
    # Ensure the trailing slash is present
    proxy_pass http://jellyfix:8000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

Note: If you change the path /jellyfix, remember to update ROOT_PATH in your .env file.

### 3. Frontend Injection

You need to inject a small JavaScript snippet into your Jellyfin Web UI.

1. Locate your Jellyfin index.html file.
- Docker: Usually inside the container at /usr/share/jellyfin/web/index.html. You may need to map a volume to access it easily.
- Linux Install: /usr/share/jellyfin/web/index.html.
- Windows: C:\Program Files\Jellyfin\Server\jellyfin-web\index.html.

2. Choose your language:
- For English, use the content of frontend/injector.js.
- For French, use the content of frontend/injector_fr.js.

3. Edit the Configuration at the top of the JS file :

```javascript const CONFIG = {
    // Your public URL (must match your reverse proxy settings)
    apiUrl: "[https://your-jellyfin-domain.com/jellyfix](https://your-jellyfin-domain.com/jellyfix)", 

    // Your Admin ID (Find it in Dashboard > Users > Your Profile > URL)
    adminId: "YOUR_JELLYFIN_ADMIN_USER_ID" 
};
```

4. Copy the entire content of the JS file.
5. Paste it into index.html, just before the closing '</body>' tag.
6. Save and Clear your browser cache (Ctrl+F5).

## 📱 Usage

For Users :
1. Navigate to any movie or show detail page.
2. Click the new "Report Issue" button (or the Flag icon).
3. Fill in the form and click Send.

For Admins
- Menu Access: A new button "Ticket Manager" will appear in your Jellyfin sidebar (or header) automatically (visible only to the Admin ID configured).
- Direct Access: Go to https://your-jellyfin-domain.com/jellyfix/admin.
- Security: Access to the dashboard is restricted. Only the user logged into Jellyfin with the ID matching JELLYFIN_ADMIN_ID can view it.

## ⚙️ Configuration (.env variables)

| Variable | Description | Default |
| :--- | :--- | :--- |
| `LANGUAGE` | Language for emails & dashboard (`EN` or `FR`) | `EN` |
| `ROOT_PATH` | Base URL path for the API | `/jellyfix` |
| `JELLYFIN_ADMIN_ID` | Your Jellyfin User ID (for security) | *Required* |
| `SMTP_SERVER` | SMTP Host (e.g., smtp.gmail.com) | *Required* |
| `SMTP_PORT` | SMTP Port (587 for STARTTLS, 465 for SSL) | `587` |
| `SMTP_USER` | SMTP Username/Email | *Required* |
| `SMTP_PASSWORD` | SMTP Password (use App Password if 2FA) | *Required* |
| `EMAIL_FROM` | Sender address | Same as User |
| `EMAIL_TO` | Where to send notifications | Same as User |

## 🔄 Updating

To update JellyFix to the latest version :
1. Pull the latest changes from git.
2. Rebuild the container:
docker-compose up -d --build
3. Check if frontend/injector.js has changed (rare) and update index.html if necessary.

## 🤝 Contributing

Feel free to fork this project and submit Pull Requests! You can easily add more languages by editing the TEXTS dictionary in backend/main.py and creating a corresponding injector_xx.js.

## 📄 License

MIT License. Free to use and modify.

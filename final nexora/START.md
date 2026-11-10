# Nexora Agent — Complete Startup & Multi-OS Guide

This guide explains how to start Nexora on **Windows, macOS (both Intel 2017+ and Apple Silicon), and Linux** using the automated launcher scripts, how dependency auto-installation works, and how the WhatsApp AI assistant operates.

---

## 🚀 How to Launch Nexora

### On Windows
Run:
```cmd
start.bat
```
*(Double-clicking `start.bat` in File Explorer also works).*

### On macOS (MacBook, Mac Mini, iMac) or Linux
Open Terminal, navigate to the folder, and run:
```bash
chmod +x start.sh
./start.sh
```

Both launchers present an interactive menu:
```text
=======================================================
         Nexora AI Sales Agent - Launcher Menu
=======================================================

Please select how you want to run Nexora:

  [1] SQLite Mode (Quickest - zero setup, no database needed)
  [2] MySQL Mode (Uses your local MySQL server)
  [3] Exit

Enter choice (1, 2, or 3):
```

---

## 📦 Automatic Dependency Detection & Installation

Both `start.bat` and `start.sh` automatically check and install the necessary dependencies:

1. **Python 3**:
   - **Windows**: Checks for `python`. If missing and `winget` is present, auto-installs Python 3.11.
   - **macOS**: Checks for `python3`. If missing and Homebrew is installed, runs `brew install python@3.11`.
   - **Linux**: Checks for `python3`. If missing on Debian/Ubuntu, auto-installs via `apt-get install python3 python3-pip python3-venv`.
2. **Node.js 18+ & npm**:
   - **Windows**: Checks for `node` and `npm`. If missing and `winget` is present, auto-installs Node.js LTS.
   - **macOS**: Checks for `node`. If missing and Homebrew is installed, runs `brew install node`.
   - **Linux**: Checks for `node`. Auto-installs via package manager if missing.
3. **Python Virtual Environment (`backend/.venv`)**:
   - If `.venv` is missing, it is created automatically.
   - If a Windows `.venv` was copied over to macOS/Linux, `start.sh` automatically detects the incompatible binaries and recreates it cleanly.
   - Automatically installs all dependencies (`pip install -r requirements.txt`).
4. **Environment Settings (`backend/.env`)**:
   - If `.env` is missing, it is created automatically from `.env.example` with zero-setup SQLite defaults.
5. **Node Packages (`wa_bridge/node_modules`)**:
   - Automatically installs Baileys, Express, and QRCode.
   - If `node_modules` was copied across operating systems or architectures (e.g. from Windows to macOS x86/ARM), `start.sh` detects the binary mismatch and reinstalls node packages cleanly.
6. **Servers**:
   - Starts the WhatsApp bridge on `http://localhost:3001` and the Django dashboard on `http://127.0.0.1:8000`.
   - Automatically opens your default web browser to the landing page.

---

## 🗄️ Understanding the Two Database Modes

### Option 1: SQLite Mode (Enter `1`) — Recommended for Dev
- **Setup needed:** None!
- **How it works:** Uses Python's built-in SQLite engine. All catalogs, accounts, orders, and chats are stored in `backend/db.sqlite3`.
- **Best for:** Instant development and testing on any PC or MacBook without needing MySQL or XAMPP installed.

### Option 2: MySQL Mode (Enter `2`)
- **Setup needed:** Start your local MySQL service (e.g., via XAMPP Control Panel on Windows, or `brew services start mysql` on macOS).
- **How it works:** Connects to MySQL on `127.0.0.1:3306` with user `root` (or configured credentials), creates the `nexora` database, and applies migrations.

---

## 🤖 WhatsApp AI Assistant: Why It Wasn't Replying & How It's Resolved

If you tested WhatsApp on your friend's MacBook and the AI wasn't replying, here are the exact reasons and fixes:

### 1. LLM API Key Was Missing in the Database
- On your PC, the database had an AI provider configured (under **Admin Dashboard → AI Provider**).
- Because `db.sqlite3` is gitignored, your friend's Mac generated a fresh database where `SystemConfig` had no API key.
- When messages arrived, Django's agent threw `RuntimeError: No LLM API key configured`.
- **Fix:** You can now supply your API key directly in `backend/.env`:
  ```bash
  LLM_BASE_URL=https://api.openai.com/v1     # Or your custom provider URL
  LLM_API_KEY=your_api_key_here
  LLM_MODEL=gpt-4o-mini                    # Or claude-sonnet-5, etc.
  ```
  `SystemConfig` will automatically load this key on startup. You can also configure it anytime in the Admin Dashboard at [http://127.0.0.1:8000/dashboard/admin/](http://127.0.0.1:8000/dashboard/admin/) (log in as `admin` / `Admin123`).

### 2. Apple / Mac Companion Device JID Formatting (`:1` / `:2`)
- WhatsApp on Apple devices (iPhones and MacBooks) often formats sender identifiers with companion device indexes (e.g. `8801712345678:1@s.whatsapp.net` or LID).
- In the original bridge, `sock.sendMessage(m.key.remoteJid)` attempted to send replies directly to this companion device JID, which WhatsApp Web servers silently drop/reject.
- **Fix:** `wa_bridge/index.js` now uses `jidNormalizedUser(m.key.remoteJid)` from Baileys, ensuring replies are always addressed to the primary phone JID (`@s.whatsapp.net`).

### 3. Ephemeral / Disappearing Messages Were Not Unwrapped
- If a chat had disappearing messages enabled, WhatsApp wrapped the text inside `ephemeralMessage.message`.
- The bridge previously only looked at `m.message.conversation`, so disappearing messages arrived with empty text.
- **Fix:** `index.js` now recursively unwraps ephemeral, view-once, and caption containers.

### 4. Background Session Auto-Resuming
- Previously, saved WhatsApp sessions in `wa_bridge/sessions/` did not start automatically when `node index.js` booted unless the user opened the browser dashboard.
- **Fix:** `wa_bridge/index.js` now automatically restores all saved WhatsApp sessions immediately upon launch.

### 5. Clear Real-Time Terminal Logs
- Both `wa_bridge` and Django now print live colored logs in the terminal whenever a message arrives, when Django processes the prompt, and when the reply is transmitted back to WhatsApp. Any failure is immediately displayed with clear diagnostics.

---

## 🛑 How to Stop the Servers

- **On Windows**: Press **`Ctrl + C`** in the terminal windows or simply close them.
- **On macOS / Linux**: In the terminal running `./start.sh`, press **`Ctrl + C`** — the script automatically shuts down both background processes cleanly.

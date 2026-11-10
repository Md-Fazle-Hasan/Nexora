# Software-Project-Design-and-Development

# Nexora Agent 🤖📦

> **AI-Powered Sales Agent & Order Management System for Social Commerce**

Nexora is an intelligent e-commerce backend built to automate customer conversations, order parsing, inventory checks, and delivery bookings on social messaging platforms like Facebook Messenger.

---

## 🌟 Overview

Operating a business on social media often involves manual messaging, stock tracking, and delivery booking bottlenecks. **Nexora** bridges the gap between conversational commerce and backend fulfillment by using an LLM-driven tool-calling engine to handle customer inquiries, process orders in real time, and integrate directly with local logistics providers.

---

## ✨ Key Features

- **Automated Conversational Sales:** AI agent handles customer product inquiries, stock availability, and pricing.
- **Intelligent Order Extraction:** Automatically extracts customer delivery details (name, phone, address, items) via AI function calling.
- **Multi-Tenant Architecture:** Secure business-level data isolation for multiple merchants operating on the platform.
- **Automated Delivery Fulfillment:** Direct integration with Pathao Courier API for one-click or automated shipping dispatch.
- **Real-Time Spreadsheets & AppSheet Sync:** Automatically syncs orders and inventory with Google Sheets/AppSheet dashboards.

---

## 🛠️ Tech Stack

- **Backend Framework:** Django (Django REST Framework)
- **AI Gateway & Intelligence:** Antigravity AI Gateway (powered by DeepSeek models)
- **Database:** MySQL / MariaDB
- **Third-Party Integrations:** Meta Graph API (Facebook Messenger Webhooks), Pathao Courier API, Google Sheets API / AppSheet

---

## 👥 Team Roles & Code Ownership

| Team Member | Role | Key Contributions |
| :--- | :--- | :--- |
| **Md. Fazle Hasan** | *Team Lead & QA Engineer* | Relational database schema design (`Business`, `Customer`, `Order`), multi-tenant data isolation, system architecture, and QA unit test suites. |
| **Tahmina Tuly** | *Backend Engineer* | REST API controllers, Facebook Messenger webhook processing, Meta Graph API integration, and Pathao delivery booking client. |
| **Sazzad Hossain** | *AI & Integration Engineer* | Antigravity AI Gateway tool-calling setup, DeepSeek function schemas, Google Sheets / AppSheet synchronization, and front-end merchant dashboard logic. |

---

## 📄 License

This project is developed as part of the Software Design and Project Management (SDPM) curriculum. All rights reserved.

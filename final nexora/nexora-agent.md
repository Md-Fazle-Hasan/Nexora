# Nexora Agent — WhatsApp AI Sales Agent & Modular Dashboard (PoC Plan)

## 1. Project Overview & Scope
This document refines the **Nexora Agent** Software Requirements Specification[span_0](start_span)[span_0](end_span)[span_1](start_span)[span_1](end_span) into a compact, modular Proof of Concept (PoC) tailored for **WhatsApp Web**. The system acts as an automated multi-business AI sales assistant that reduces repetitive manual work while keeping business owners in full control of their inventory and orders[span_2](start_span)[span_2](end_span)[span_3](start_span)[span_3](end_span).

### Core PoC Capabilities
* **WhatsApp Web Integration:** Connects each business client's WhatsApp account via a lightweight Node.js bridge (replacing Facebook Messenger and Meta Graph API)[span_4](start_span)[span_4](end_span)[span_5](start_span)[span_5](end_span) to receive customer inquiries and send automated replies[span_6](start_span)[span_6](end_span).
* **Multimodal AI Sales Agent:** Processes both text messages and customer-provided product photos or screenshots to identify items[span_7](start_span)[span_7](end_span)[span_8](start_span)[span_8](end_span), verify SKU availability (size, color, variant, price, and stock)[span_9](start_span)[span_9](end_span)[span_10](start_span)[span_10](end_span), remember customer history[span_11](start_span)[span_11](end_span)[span_12](start_span)[span_12](end_span), and place or modify orders[span_13](start_span)[span_13](end_span)[span_14](start_span)[span_14](end_span).
* **Strict Tool-Based Database Access:** The AI never directly manipulates the MySQL database[span_15](start_span)[span_15](end_span); it executes controlled backend Python tools to read verified catalog data and create orders[span_16](start_span)[span_16](end_span)[span_17](start_span)[span_17](end_span)[span_18](start_span)[span_18](end_span).
* **Role-Based Dual Dashboards:**
  * **Business Client Dashboard:** Displays active products, SKU inventory, pending/completed orders, and conversation logs[span_19](start_span)[span_19](end_span)[span_20](start_span)[span_20](end_span)[span_21](start_span)[span_21](end_span). Business owners can **Accept** or **Cancel** orders with one click, triggering the AI agent to automatically notify the customer over WhatsApp.
  * **System Admin Panel:** Monitors all tenant accounts, tracks message/token usage, configures active LLM API keys and models, and provides troubleshooting tools (session resets, error logs, and user management)[span_22](start_span)[span_22](end_span)[span_23](start_span)[span_23](end_span)[span_24](start_span)[span_24](end_span).
* **Modular Widget Data Hookups:** Dashboard views consume data via a decoupled JSON widget registry so UI components can be rearranged or redesigned without rewriting backend logic[span_25](start_span)[span_25](end_span).
* **Exclusions:** Full accounting, advertising management, and payment-gateway processing remain out of scope for this PoC[span_26](start_span)[span_26](end_span).

---

## 2. Technology Stack & Architecture

### Tech Stack
* **Backend Core:** Python + Django (handles authentication, ORM, AI orchestration, and modular JSON dashboard endpoints)[span_27](start_span)[span_27](end_span)[span_28](start_span)[span_28](end_span)[span_29](start_span)[span_29](end_span).
* **WhatsApp Bridge:** Node.js (`@whiskeysockets/baileys` + Express) running as an independent service module for WhatsApp Web WebSocket sessions[span_30](start_span)[span_30](end_span).
* **Database:** MySQL 8.0+ (using relational foreign keys for tenant isolation and `JSONField` columns to minimize table count)[span_31](start_span)[span_31](end_span)[span_32](start_span)[span_32](end_span)[span_33](start_span)[span_33](end_span).
* **Frontend:** Vanilla HTML5, CSS3, and JavaScript (zero build step, responsive across desktop and mobile devices)[span_34](start_span)[span_34](end_span)[span_35](start_span)[span_35](end_span).

### Data Flow Architecture
```text
Customer (WhatsApp Message / Product Screenshot)
       │
       ▼
[Node.js WhatsApp Web Bridge] (Port 3001)
  • Manages per-tenant WhatsApp Web QR sessions
  • Extracts text + Base64 media from incoming messages
       │  ▲
       ▼  │ (Webhook: POST /api/webhook/wa/ | Outbound: POST /wa/send/)
[Django Monolith Backend] (Port 8000 — Single App: `core`)
  ├── Auth & Role Router (Business Client vs. System Admin)
  ├── Multimodal AI Engine (Vision + Controlled Tool Calling)
  └── Modular Dashboard Registry (JSON Widget Hookups)
       │
       ▼
[MySQL Database] (5 Consolidated Tables with Strict Tenant Isolation)
```

---

## 3. Consolidated MySQL Database Schema

Instead of 16 separate tables[span_36](start_span)[span_36](end_span)[span_37](start_span)[span_37](end_span), the PoC consolidates variants, inventory, and message logs into **5 core models (~60 lines of `models.py`)** while preserving strict data isolation between businesses[span_38](start_span)[span_38](end_span)[span_39](start_span)[span_39](end_span)[span_40](start_span)[span_40](end_span).

| Model Name | Primary Fields | JSON Schema / Purpose |
| :--- | :--- | :--- |
| **`SystemConfig`** | `id`, `llm_base_url`, `api_key`, `model_name`, `system_prompt`, `error_logs` (JSON) | Stores global AI credentials protected from unauthorized access[span_41](start_span)[span_41](end_span)[span_42](start_span)[span_42](end_span) and a rolling array of recent system/API errors for the Admin Panel[span_43](start_span)[span_43](end_span)[span_44](start_span)[span_44](end_span). |
| **`Tenant`** | `id`, `user` (OneToOne `User`), `business_name`, `wa_status`, `usage_stats` (JSON), `is_active` | Isolates each business account[span_45](start_span)[span_45](end_span)[span_46](start_span)[span_46](end_span). `usage_stats` tracks `{"messages_Count": 140, "tokens_used": 48200, "last_active": "..."}`. |
| **`Product`** | `id`, `tenant` (FK), `name`, `description`, `base_price`, `image_url`, `skus` (JSON) | Replaces separate `ProductVariant` and `Inventory` tables[span_47](start_span)[span_47](end_span). `skus` holds `[ {"sku": "TSH-BLK-L", "size": "L", "color": "Black", "price": 500, "stock": 15} ]`[span_48](start_span)[span_48](end_span). |
| **`Conversation`** | `id`, `tenant` (FK), `customer_phone`, `customer_name`, `messages` (JSON), `needs_human` (Bool) | Combines `Customer`, `Conversation`, and `Message`[span_49](start_span)[span_49](end_span)[span_50](start_span)[span_50](end_span). Stores customer identity, rolling chat context, and human-handover status[span_51](start_span)[span_51](end_span)[span_52](start_span)[span_52](end_span). |
| **`Order`** | `id`, `tenant` (FK), `customer_phone`, `customer_name`, `address`, `items` (JSON), `total`, `status`, `created_at` | Combines `Order`, `OrderItem`, and `CustomizationRequest`[span_53](start_span)[span_53](end_span). `status` enum: `PENDING`, `ACCEPTED`, `CANCELLED`, `COMPLETED`[span_54](start_span)[span_54](end_span). |

---

## 4. Core Backend Modules

### 4.1 Node.js WhatsApp Web Service (`wa_bridge/index.js`)
Kept under **80 lines of JavaScript** as a standalone integration module[span_55](start_span)[span_55](end_span):
1. **`GET /wa/:tenant_id/status`**: Returns `{ "status": "CONNECTED" | "QR_READY", "qr": "<qr_data_url>" }` so the Business Dashboard can render the QR code for login.
2. **`POST /wa/:tenant_id/send`**: Accepts `{ "phone": "8801...", "text": "..." }` from Django to send AI responses or order status updates to the customer.
3. **`POST /wa/:tenant_id/reset`**: Called by the Admin Panel to clear corrupted session files and restart a tenant's WhatsApp client.
4. **Incoming Message Listener**: Deduplicates message IDs so duplicate webhook events never create duplicate orders[span_56](start_span)[span_56](end_span), converts incoming images/screenshots to Base64, and forwards the payload to Django's `/api/webhook/wa/`.

### 4.2 Multimodal AI Agent & Tool Architecture (`core/agent.py`)
The AI agent uses verified database records via controlled Python tools rather than direct database queries[span_57](start_span)[span_57](end_span)[span_58](start_span)[span_58](end_span)[span_59](start_span)[span_59](end_span):

* **Screenshot & Image Analysis Pipeline:** When a customer sends a product photo or screenshot[span_60](start_span)[span_60](end_span)[span_61](start_span)[span_61](end_span), Django passes the Base64 image plus a compact list of the tenant's product names to the multimodal LLM. The model identifies the visual match and invokes `search_inventory()` to inspect exact SKU availability[span_62](start_span)[span_62](end_span)[span_63](start_span)[span_63](end_span).
* **Controlled AI Tools:**
  1. `search_inventory(query: str)`: Searches the tenant's `Product` records and returns prices, sizes, colors, variants, and stock counts from the `skus` JSON[span_64](start_span)[span_64](end_span)[span_65](start_span)[span_65](end_span).
  2. `get_customer_context(phone: str)`: Fetches previous orders and saved delivery details for returning customers[span_66](start_span)[span_66](end_span)[span_67](start_span)[span_67](end_span).
  3. `create_or_update_order(name: str, address: str, sku: str, qty: int, notes: str)`: Validates SKU stock, collects required customer info (name, phone, address, SKU, quantity)[span_68](start_span)[span_68](end_span), creates or modifies a `PENDING` order, and deducts stock[span_69](start_span)[span_69](end_span)[span_70](start_span)[span_70](end_span).
  4. `request_human_support(reason: str)`: Sets `Conversation.needs_human = True` when a customer asks an uncertain, complex, or custom question, pausing AI auto-replies and alerting the business owner[span_71](start_span)[span_71](end_span)[span_72](start_span)[span_72](end_span)[span_73](start_span)[span_73](end_span)[span_74](start_span)[span_74](end_span).

---

## 5. Dual Dashboards & Modular Data Hookups

### 5.1 Modular Widget Provider Pattern (`core/widgets.py`)
To ensure the dashboards can be changed later with zero backend refactoring, all dashboard metrics and tables are served through a dictionary of pluggable data functions:

```python
# core/widgets.py
CLIENT_WIDGETS = {
    "summary_cards": lambda t: {
        "products": t.product_set.count(),
        "pending_orders": t.order_set.filter(status="PENDING").count(),
        "completed_orders": t.order_set.filter(status="COMPLETED").count(),
        "human_alerts": t.conversation_set.filter(needs_human=True).count(),
    },
    "recent_orders": lambda t: list(
        t.order_set.order_by("-created_at").values(
            "id", "customer_name", "customer_phone", "address", "items", "total", "status"
        )[:50]
    ),
    "catalog_skus": lambda t: list(
        t.product_set.values("id", "name", "base_price", "skus")
    ),
    "chat_threads": lambda t: list(
        t.conversation_set.values("id", "customer_phone", "customer_name", "needs_human", "messages")
    ),
}

ADMIN_WIDGETS = {
    "system_overview": lambda: {
        "total_tenants": Tenant.objects.count(),
        "active_wa_sessions": Tenant.objects.filter(wa_status="CONNECTED").count(),
    },
    "tenant_usage": lambda: list(
        Tenant.objects.values("id", "business_name", "wa_status", "is_active", "usage_stats")
    ),
    "config_and_logs": lambda: SystemConfig.objects.values(
        "llm_base_url", "model_name", "system_prompt", "error_logs"
    ).first(),
}
```

### 5.2 Frontend Auto-Binder (`static/app.js`)
Any HTML element on either dashboard can subscribe to a backend widget simply by declaring `data-widget="widget_key"`. A 25-line Vanilla JS helper fetches `/api/dashboard/?widgets=...` and renders the data into the DOM. Adding or removing a section on the dashboard only requires editing the HTML template and adding a lambda entry in `widgets.py`.

### 5.3 Dashboard Feature Breakdown

#### Dashboard 1: Business Client Panel (`/dashboard/client/`)
* **WhatsApp Link Card:** Shows live session status (`Connected` / `Disconnected`) and displays the scan-to-connect QR code.
* **Order Queue & One-Click Accept/Cancel:**
  * Displays incoming (`PENDING`), `ACCEPTED`, `COMPLETED`, and `CANCELLED` orders clearly[span_75](start_span)[span_75](end_span)[span_76](start_span)[span_76](end_span).
  * **Accept Button:** Updates status to `ACCEPTED`[span_77](start_span)[span_77](end_span) and triggers the AI agent to send a WhatsApp confirmation message to the customer.
  * **Cancel Button:** Updates status to `CANCELLED`[span_78](start_span)[span_78](end_span), restores the SKU stock in `Product.skus`, and instructs the AI agent to politely notify the customer on WhatsApp.
* **Product & SKU Manager:** Allows adding products and editing SKU arrays (color, size, price, stock quantity) inline[span_79](start_span)[span_79](end_span).
* **Conversation & Handover View:** Allows reviewing chat histories[span_80](start_span)[span_80](end_span) and resolving `needs_human` flags[span_81](start_span)[span_81](end_span).

#### Dashboard 2: System Admin Panel (`/dashboard/admin/`)
* **AI Provider & API Key Manager:** Updates `SystemConfig` (`llm_base_url`, `api_key`, `model_name`, `system_prompt`) in real time without restarting the server[span_82](start_span)[span_82](end_span)[span_83](start_span)[span_83](end_span).
* **Tenant & Usage Monitor:** Lists all registered businesses, their WhatsApp connection state, total messages handled, and token consumption[span_84](start_span)[span_84](end_span).
* **Troubleshooting & User Controls:**
  * **Force Reconnect / Reset WA Session:** Calls the Node.js bridge to reset a stuck WhatsApp Web client.
  * **Suspend / Activate Business Account:** Toggles `Tenant.is_active`[span_85](start_span)[span_85](end_span).
  * **Error & Audit Log Viewer:** Displays recent webhook, AI, or database exceptions logged in `SystemConfig.error_logs`[span_86](start_span)[span_86](end_span)[span_87](start_span)[span_87](end_span)[span_88](start_span)[span_88](end_span).

---

## 6. Compact API Specification

| Method & Endpoint | Role / Caller | Description |
| :--- | :--- | :--- |
| `POST /api/webhook/wa/` | Node.js Bridge | Receives incoming WhatsApp text/images, runs the AI agent, and returns the reply[span_89](start_span)[span_89](end_span)[span_90](start_span)[span_90](end_span). |
| `GET /api/dashboard/` | Client / Admin | Returns requested modular widget JSON based on the logged-in user's role[span_91](start_span)[span_91](end_span). |
| `POST /api/order/<id>/action/` | Business Client | Accepts `{ "action": "ACCEPTED" \| "CANCELLED" \| "COMPLETED", "note": "..." }`, updates DB, and notifies customer via WhatsApp[span_92](start_span)[span_92](end_span)[span_93](start_span)[span_93](end_span). |
| `POST /api/product/save/` | Business Client | Creates or updates a product and its `skus` JSON inventory[span_94](start_span)[span_94](end_span). |
| `POST /api/admin/config/` | System Admin | Updates the active AI model, API key, or tenant status (`is_active`, session reset)[span_95](start_span)[span_95](end_span). |

---

## 7. Compact Project Directory & Line-Count Budget

```text
nexora-wa-poc/
├── wa_bridge/
│   ├── package.json
│   └── index.js             # ~80 lines  | Baileys WhatsApp Web session manager + webhook forwarder
├── backend/
│   ├── manage.py
│   ├── nexora/              # ~60 lines  | Django settings.py (MySQL config) & urls.py
│   ├── core/
│   │   ├── models.py        # ~60 lines  | 5 models: SystemConfig, Tenant, Product, Conversation, Order
│   │   ├── agent.py         # ~95 lines  | Multimodal LLM client + 4 controlled tool functions
│   │   ├── widgets.py       # ~55 lines  | Modular dashboard data hookups (CLIENT_WIDGETS & ADMIN_WIDGETS)
│   │   └── views.py         # ~110 lines | Auth router, WA webhook, order accept/cancel notifier, CRUD
│   └── templates/
│       ├── login.html       # Single login screen (routes staff to Admin, tenants to Client)
│       ├── client.html      # Business Owner dashboard + modular Vanilla JS data binder
│       └── admin.html       # System Admin panel + API key config & troubleshooting tools
```
*Total Python Backend Code: **~380 lines** | Total Node.js Code: **~80 lines***

---

## 8. End-to-End Execution Workflow

1. **System Setup:** Admin logs into `/dashboard/admin/`, enters the LLM API key and model name, and creates a Business Client account[span_96](start_span)[span_96](end_span).
2. **Business Onboarding:** The Business Owner logs into `/dashboard/client/`, scans the WhatsApp QR code, and inputs products with their SKU variants (`size`, `color`, `price`, `stock`)[span_97](start_span)[span_97](end_span)[span_98](start_span)[span_98](end_span).
3. **Customer Inquiry:** A customer sends a text message or product screenshot on WhatsApp[span_99](start_span)[span_99](end_span)[span_100](start_span)[span_100](end_span)[span_101](start_span)[span_101](end_span).
4. **AI Processing & Tool Execution:**
   * The Node.js bridge forwards the message/image to Django[span_102](start_span)[span_102](end_span).
   * `agent.py` loads the customer's conversation history[span_103](start_span)[span_103](end_span), analyzes any attached image[span_104](start_span)[span_104](end_span), and invokes `search_inventory()` to verify stock and SKU options[span_105](start_span)[span_105](end_span)[span_106](start_span)[span_106](end_span).
   * The AI replies on WhatsApp with accurate availability and pricing[span_107](start_span)[span_107](end_span)[span_108](start_span)[span_108](end_span)[span_109](start_span)[span_109](end_span).
5. **Order Placement:** Once the customer confirms the item, SKU variant, name, and delivery address, the AI calls `create_or_update_order()` to save a `PENDING` order in MySQL[span_110](start_span)[span_110](end_span)[span_111](start_span)[span_111](end_span)[span_112](start_span)[span_112](end_span).
6. **Business Owner Decision & Automated Notification:**
   * The new order appears in the Business Client Dashboard's order feed.
   * The Business Owner clicks **Accept** or **Cancel**.
   * Django updates the order status[span_113](start_span)[span_113](end_span), adjusts SKU stock if cancelled, logs the action[span_114](start_span)[span_114](end_span), and triggers the AI agent to send an immediate WhatsApp status update to the customer.

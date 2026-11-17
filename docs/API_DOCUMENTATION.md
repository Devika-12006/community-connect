# Community Connect &mdash; API & Route Specifications

This document outlines the routes, role-based authorization requirements, request formats, and response specifications across all application blueprints.

---

## 1. Authentication & System Routes (`/auth`)

### `POST /auth/login`
- **Access**: Public
- **Description**: Authenticates user credentials and establishes a secure HTTP session.
- **Form Data**:
  - `username` (string, required): Username or email address.
  - `password` (string, required): Account plaintext password.
  - `remember` (boolean, optional): Session persistence flag.
- **Responses**:
  - `302 Found`: Redirects to respective role dashboard based on user role (`resident.dashboard`, `worker.dashboard`, or `manager.dashboard`).
  - `200 OK`: Re-renders login form with flash error on invalid credentials.

### `POST /auth/register`
- **Access**: Public
- **Description**: Self-service resident account registration.
- **Form Data**:
  - `full_name` (string, required)
  - `username` (string, required, unique)
  - `email` (string, required, unique)
  - `password` (string, required, min 6 chars)
  - `confirm_password` (string, required)
  - `building_block` (string, required, e.g. "Block A")
  - `flat_no` (string, required, e.g. "302")
  - `phone` (string, optional)
- **Responses**:
  - `302 Found`: Redirects to `/auth/login` with success banner.

### `GET /auth/logout`
- **Access**: Authenticated (`@login_required`)
- **Description**: Invalidates session cookie and logs user out.

### `POST /auth/notifications/read/<int:notif_id>`
- **Access**: Authenticated (`@login_required`)
- **Description**: Marks specific in-app notification as read.
- **Response**: `{"success": true}`

---

## 2. Resident Routes (`/resident`)
*Enforces `@role_required('resident')` server-side.*

### `GET /resident/dashboard`
- **Description**: Renders resident home metrics (active tickets, pending approvals, closed count) and recent submissions.

### `GET /resident/complaints`
- **Description**: Filterable view of all complaints logged by the authenticated resident.
- **Query Params**: `status` (Submitted, Assigned, In Progress, Pending Verification, Rework Required, Closed).

### `POST /resident/complaints/new`
- **Description**: Submits new complaint with automated priority calculation and duplicate check.
- **Form Data**:
  - `title` (string, required)
  - `description` (string, required)
  - `category_id` (integer, required)
  - `asset_id` (integer, optional)
  - `location_details` (string, required)
  - `severity` (integer, 1-5, default 3)
  - `work_impact` (integer, 1-5, default 2)
  - `photo` (file, optional, png/jpg/jpeg/webp)
- **Response**: `302 Found` redirecting to complaint detail.

### `POST /resident/complaints/<int:complaint_id>/verify`
- **Description**: Resident sign-off or rejection of technician completion evidence.
- **Form Data**:
  - `decision` (string, 'approve' or 'reject')
  - If approve:
    - `rating` (integer, 1-5 stars)
    - `comments` (string, optional)
  - If reject:
    - `rejection_reason` (string, required)
- **Response**: `302 Found` redirecting to complaint detail.

---

## 3. Maintenance Technician Routes (`/worker`)
*Enforces `@role_required('worker')` server-side.*

### `GET /worker/dashboard`
- **Description**: Worker control center displaying newly assigned tasks, active work, rework queue, and resident ratings.

### `POST /worker/tasks/<int:task_id>/accept`
- **Description**: Acknowledges task and transitions complaint status to `In Progress`.

### `POST /worker/tasks/<int:task_id>/submit-evidence`
- **Description**: Submits physical repair proof for resident verification.
- **Form Data**:
  - `after_photo` (file, required)
  - `before_photo` (file, optional)
  - `inspection_notes` (string, optional)
  - `repair_description` (string, required)
  - `parts_replaced` (string, optional)
  - `time_spent_minutes` (integer, default 45)
- **Response**: Transitions complaint to `Pending Verification`.

---

## 4. Community Manager Routes (`/manager`)
*Enforces `@role_required('manager')` server-side.*

### `GET /manager/dashboard`
- **Description**: Executive operations console with system metrics, MTTR, response times, and recurring failure alerts.

### `POST /manager/complaints/<int:complaint_id>/assign`
- **Description**: Dispatches complaint to a technician with target SLA.
- **Form Data**: `worker_id` (int), `deadline_days` (int), `instructions` (string).

### `POST /manager/complaints/<int:complaint_id>/override-priority`
- **Description**: Overrides automated priority engine calculation with mandatory justification.
- **Form Data**: `priority_level` (Critical/High/Medium/Low), `override_reason` (string).

### `POST /manager/complaints/<int:complaint_id>/merge-duplicate`
- **Description**: Merges duplicate ticket into primary complaint and closes it with an audit record.
- **Form Data**: `primary_complaint_id` (int).

### `POST /manager/complaints/<int:complaint_id>/exception-close`
- **Description**: Manager exception sign-off when resident is unavailable.
- **Form Data**: `exception_reason` (string, required).

### `POST /manager/assets/new`
- **Description**: Registers infrastructure asset and automatically generates PNG QR code.
- **Form Data**: `asset_code`, `name`, `category`, `building`, `location`, `criticality` (1-5), `condition`, `maintenance_frequency_days`, `notes`.

---

## 5. REST & Asynchronous Endpoints (`/api`)

### `GET /api/analytics/charts`
- **Description**: Serves structured JSON datasets for Chart.js dashboards.
- **Sample Output**:
```json
{
  "categories": { "labels": ["Elevators", "Water pumps", ...], "data": [4, 2, ...] },
  "priorities": { "labels": ["Critical", "High", "Medium", "Low"], "data": [2, 3, 1, 1] },
  "statuses": { "labels": ["Submitted", "Assigned", "In Progress", ...], "data": [1, 2, ...] },
  "monthly": { "labels": ["Jun 2026", "Jul 2026", ...], "data": [5, 8, ...] }
}
```

### `POST /api/complaints/check-duplicate`
- **Description**: Debounced real-time duplicate check during resident typing.
- **Payload**:
```json
{
  "title": "Elevator jerking",
  "description": "Stops between floors",
  "category_id": 1,
  "location_details": "Block A",
  "asset_id": 1
}
```
- **Response**: Array of candidate matches with confidence levels and similarity scores.

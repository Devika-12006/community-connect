# Community Connect &mdash; End-User Manual & Operational Guide

This user guide provides operational instructions for all three user roles: **Residents**, **Maintenance Workers**, and **Community Facility Managers**.

---

## 1. Resident Portal Guide

### A. Registering an Account
1. Navigate to `http://localhost:5000/auth/register`.
2. Enter your **Full Name**, choose a **Username**, and enter your **Email Address**.
3. Select your **Building Block / Tower** (e.g. Tower A - Tulip) and enter your **Flat / Unit Number** (e.g. 302).
4. Provide a valid mobile contact number and choose a secure password (minimum 6 characters).
5. Click **Register Account** and log in with your new credentials.

### B. Reporting a Maintenance Issue
1. From your **Resident Dashboard**, click the blue **Report Maintenance Issue** button (or navigate to `/resident/complaints/new`).
2. Enter a descriptive **Complaint Title** (e.g. *"Passenger Elevator A1 doors jammed on 4th floor"*).
3. Select the appropriate **Complaint Category** (e.g. *Elevators & Lifts*).
4. If the issue is related to specific community equipment, select the **Associated Asset** from the dropdown or scan the physical QR badge on the machine.
5. Provide the exact **Location Details** (e.g. *Tower A, 4th Floor Corridor near Flat 402*).
6. Set the **Severity Level (S)** using the slider (1 = Cosmetic to 5 = Emergency Hazard).
7. Set the **Work Impact (W)** slider (1 = Single Flat to 5 = Entire Community).
8. Observe the **Live Priority Score Preview**: The system automatically computes:
   $$\mathbf{P = (7 \times S) + (5 \times A) + (4 \times W) + (4 \times R)}$$
9. Optionally attach a clear photograph showing the problem.
10. Click **Submit Complaint**. You will be redirected to the ticket details page with a unique complaint ID (e.g. `CC-2026-0001`).

### C. Checking for Duplicate Complaints
As you type your title and description, the **Live Duplicate Detection Engine** scans recent active complaints within a 14-day window. If similar reports exist, a warning box appears displaying existing open tickets to prevent duplicate service requests.

### D. Verifying Completed Maintenance
1. When a technician finishes repairs and submits completion photographs, you will receive an in-app notification: *"Verification Required: CC-2026-XXXX"*.
2. Open the complaint detail page.
3. Inspect the **Worker Repair Evidence** card, including the before and after photographs, parts replaced, and technician inspection notes.
4. Choose one of two actions:
   - **Option A: Approve Repair & Close**: Select a star rating (1 to 5 stars), enter optional feedback comments, and click **Confirm & Finalize Closure**.
   - **Option B: Reject Repair**: If the defect is still present, provide a detailed **Rejection Reason** and click **Reject & Demand Rework**. The ticket will automatically return to the technician's queue for corrective action.

---

## 2. Maintenance Worker Portal Guide

### A. Viewing Your Work Queue
1. Log in using your assigned worker credentials (e.g. `worker_elevator` / `Worker@123`).
2. The **Worker Dashboard** displays your tasks in four organized tabs:
   - **Newly Assigned**: Tickets dispatched to you by management awaiting acceptance.
   - **In Progress**: Active maintenance jobs currently underway.
   - **Rework / Rejected**: High-priority tasks rejected by residents requiring corrective service.
   - **Pending Verification**: Tasks where you have submitted evidence and are awaiting resident sign-off.

### B. Accepting a Task
1. Under the **Newly Assigned** tab, click **Inspect & Accept** on any task card.
2. Review the problem description, location, resident phone number, and management instructions.
3. Click the green **Accept & Start Maintenance** button.
4. This records your start timestamp, updates the status to `In Progress`, and notifies the resident that work has commenced.

### C. Submitting Repair Evidence
1. Once on-site repair work is complete, open the active task.
2. Under **Submit Repair Evidence**:
   - Provide a concise description of repairs executed (e.g. *"Replaced faulty door contact sensor and re-tensioned safety cable"*).
   - Enter technician **Inspection Notes** regarding overall equipment health.
   - List any **Parts / Materials Replaced** (e.g. *"15A Omron Relay Switch"*).
   - Record total **Time Spent (Minutes)**.
   - Attach a clear **After-Repair Photographic Proof** showing the resolved state.
3. Click **Submit for Resident Verification**. The ticket status transitions to `Pending Verification`.

---

## 3. Community Facility Manager Guide

### A. Executive Operations Dashboard
1. Log in using administrator credentials (`manager` / `Manager@123`).
2. Monitor key operational metrics:
   - Total complaints, open active issues, and critical emergency counts.
   - Assets due for scheduled preventive maintenance.
   - Average technician response time and resolution duration in hours.
   - Chronic Equipment Reliability Alert banners flagging assets with $\ge 3$ failures in 30 days.

### B. Complaints Triage & Worker Dispatch
1. Open the **Complaints Triage Console** (`/manager/complaints`).
2. Filter tickets by status, priority tier, category, or specific asset.
3. Open any unassigned ticket.
4. Under **Worker Assignment & Dispatch**, select an available worker matching the required trade specialty.
5. Set the target SLA deadline (e.g. 24 Hours for Critical, 48 Hours for High) and add operational instructions.
6. Click **Assign Worker & Dispatch**.

### C. Manual Priority Override
1. If unique operational factors require adjusting the automated priority, click **Override Priority** on any complaint detail page.
2. Select the new priority tier (`Critical`, `High`, `Medium`, or `Low`).
3. Enter a mandatory written justification (e.g. *"VIP delegation visiting Tower A; temporary elevator downtime elevated to Critical"*).
4. Click **Confirm & Log Override**. The action is permanently recorded in the immutable `AuditLog`.

### D. Duplicate Merging
1. If the duplicate detection engine identifies matching reports on the same asset or location, a **Potential Duplicate Alert** appears on the complaint page.
2. Click **Merge as Duplicate** to link redundant tickets to the primary work order and automatically close the duplicate.

### E. Documented Manager Exception Closure
1. In scenarios where a resident is travelling, unreachable, or absent after 72 hours following common-area repair verification, managers can execute an exception closure.
2. Click **Exception Close**, record the operational justification, and submit. The ticket transitions to `Closed` with an auditable justification tag.

### F. Asset Registry & QR Code Generation
1. Navigate to **Asset Registry** (`/manager/assets`) and click **Register New Asset**.
2. Enter the Asset Code (e.g. `AST-PUMP-03`), equipment name, category, building zone, criticality rating (1 to 5), and preventive maintenance frequency (days).
3. Click **Save Asset & Generate QR Code**.
4. The system renders a scannable high-resolution QR badge available for immediate download and physical printing.

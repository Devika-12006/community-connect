# Community Connect

A complete, responsive, interactive web application prototype built for gated residential communities to report maintenance issues, track progress, triage & assign tasks to workers, verify completion evidence, and collect resident feedback.

## Features

- **Multi-Role Prototype Switcher**: Instantly switch between **Resident**, **Community Manager**, and **Maintenance Worker** portals.
- **Zero Mock Preload**: Boots clean with zero mock complaints or workers — every count, breakdown, and workload metric derives strictly from records created during testing.
- **Client-Side Persistence (IndexedDB)**: Structured data and binary image blobs persist locally via `idb`.
- **Multi-Tab Sync**: Synchronizes updates between open browser tabs using the `BroadcastChannel` API.
- **Smart Assistance**: Rule-based keyword category suggestions, open-complaint duplicate warnings, and priority recommendations.
- **Resident Privacy Protection**: Management internal notes are strictly hidden from resident views; community map hides private resident names and flat numbers.
- **Complete Verification Lifecycle**: Workers submit photo completion evidence + repair notes; managers approve or return for correction; residents rate resolutions from 1–5 stars and close tickets.
- **Reports & Export**: Dynamic resolution metrics, worker completion counts, and a working CSV export.

## Tech Stack

- **React 19** with TypeScript
- **Tailwind CSS v4**
- **Vite**
- **IndexedDB** (`idb`) for local storage
- **React Router v7**
- **Lucide React** for accessible UI icons
- **Vitest** for automated unit testing

## Getting Started

### Installation
```bash
npm install
```

### Run Locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Run Automated Tests
```bash
npm test
```

### Build for Production
```bash
npm run build
```

## Testing the End-to-End Workflow

1. **Manager**: Go to **Workers** &rarr; click **Add New Worker** &rarr; create a worker (e.g. `Ramesh Kumar`, Specialty: `Plumbing`).
2. **Resident**: Open the top-bar **Role Switcher** &rarr; under Resident click **New Profile** &rarr; create a resident profile (e.g. `Devika Sharma`, `Block A`, Flat `302`).
3. **Submit Report**: Click **Report an Issue** &rarr; enter title and description &rarr; attach a photo &rarr; select location &rarr; submit.
4. **Manager Triage**: Switch to **Community Manager** &rarr; review the complaint &rarr; assign the worker &rarr; optionally log an internal note.
5. **Worker Execution**: Switch to **Maintenance Worker** &rarr; start work &rarr; log progress &rarr; upload completion photo + note &rarr; submit for review.
6. **Manager Approval**: Switch to **Community Manager** &rarr; verify completion evidence &rarr; approve resolution.
7. **Resident Close**: Switch to **Resident** &rarr; inspect proof &rarr; submit 1–5 star rating &rarr; confirm resolution to close.
8. **Reports**: Switch to **Community Manager** &rarr; check **Reports & Analytics** &rarr; export CSV.

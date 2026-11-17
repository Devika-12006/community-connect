// Community Connect Client Scripts

// Quick-fill login credentials for academic and demo evaluations
function fillDemoLogin(username, password) {
  const userField = document.getElementById('username');
  const passField = document.getElementById('password');
  if (userField && passField) {
    userField.value = username;
    passField.value = password;
  }
}

// Real-time asynchronous duplicate complaint detector
let duplicateCheckTimeout = null;
function initRealtimeDuplicateCheck() {
  const titleInput = document.getElementById('complaint-title');
  const descInput = document.getElementById('complaint-desc');
  const catSelect = document.getElementById('complaint-category');
  const assetSelect = document.getElementById('complaint-asset');
  const locInput = document.getElementById('complaint-location');
  const duplicateAlertBox = document.getElementById('duplicate-alert-box');
  const duplicateList = document.getElementById('duplicate-list');

  if (!titleInput || !duplicateAlertBox) return;

  function performCheck() {
    const title = titleInput.value.trim();
    const desc = descInput ? descInput.value.trim() : '';
    const catId = catSelect ? catSelect.value : null;
    const assetId = assetSelect ? assetSelect.value : null;
    const loc = locInput ? locInput.value.trim() : '';

    if (title.length < 5) {
      duplicateAlertBox.classList.add('d-none');
      return;
    }

    fetch('/api/complaints/check-duplicate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: title,
        description: desc,
        category_id: catId,
        location_details: loc,
        asset_id: assetId
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.duplicates && data.duplicates.length > 0) {
        duplicateAlertBox.classList.remove('d-none');
        duplicateList.innerHTML = '';
        data.duplicates.forEach(item => {
          const li = document.createElement('li');
          li.className = 'list-group-item list-group-item-warning d-flex justify-content-between align-items-center py-2';
          li.innerHTML = `
            <div>
              <strong>#${item.complaint_no}</strong>: ${item.title}
              <small class="text-muted d-block">${item.reasons.join(', ')} (Status: ${item.status})</small>
            </div>
            <span class="badge bg-danger rounded-pill">${item.confidence} Match</span>
          `;
          duplicateList.appendChild(li);
        });
      } else {
        duplicateAlertBox.classList.add('d-none');
      }
    })
    .catch(err => console.error('Duplicate check error:', err));
  }

  [titleInput, descInput, locInput].forEach(elem => {
    if (elem) {
      elem.addEventListener('input', () => {
        clearTimeout(duplicateCheckTimeout);
        duplicateCheckTimeout = setTimeout(performCheck, 400);
      });
    }
  });

  if (catSelect) catSelect.addEventListener('change', performCheck);
  if (assetSelect) assetSelect.addEventListener('change', performCheck);
}

// Dynamic priority estimation preview on complaint submission form
function initPriorityPreview() {
  const severityInput = document.getElementById('severity-slider');
  const severityVal = document.getElementById('severity-val');
  const impactInput = document.getElementById('impact-slider');
  const impactVal = document.getElementById('impact-val');
  const priorityBadge = document.getElementById('priority-preview-badge');
  const priorityFormula = document.getElementById('priority-formula-preview');

  if (!severityInput || !impactInput) return;

  function updatePreview() {
    const s = parseInt(severityInput.value) || 3;
    const w = parseInt(impactInput.value) || 2;
    const a = 3; // Baseline estimated asset criticality
    const r = 1; // Baseline recurrence

    if (severityVal) severityVal.textContent = s;
    if (impactVal) impactVal.textContent = w;

    // P = 7S + 5A + 4W + 4R
    const p = (7 * s) + (5 * a) + (4 * w) + (4 * r);
    let level = 'Low';
    let badgeClass = 'bg-secondary';

    if (p >= 75) {
      level = 'Critical';
      badgeClass = 'bg-danger';
    } else if (p >= 55) {
      level = 'High';
      badgeClass = 'bg-warning text-dark';
    } else if (p >= 35) {
      level = 'Medium';
      badgeClass = 'bg-info text-dark';
    }

    if (priorityBadge) {
      priorityBadge.textContent = `${level} (Est. Score: ${p})`;
      priorityBadge.className = `badge ${badgeClass} fs-6 px-3 py-2`;
    }

    if (priorityFormula) {
      priorityFormula.textContent = `Formula: 7(${s}) + 5(${a}) + 4(${w}) + 4(${r}) = ${p}`;
    }
  }

  severityInput.addEventListener('input', updatePreview);
  impactInput.addEventListener('input', updatePreview);
  updatePreview();
}

document.addEventListener('DOMContentLoaded', () => {
  initRealtimeDuplicateCheck();
  initPriorityPreview();
});

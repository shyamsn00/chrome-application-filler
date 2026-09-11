/**
 * AutoFill Pro - Options Page Logic
 * Manages Profiles, Settings, Preferences, and Per-Website Rules.
 */

document.addEventListener('DOMContentLoaded', async () => {
  let allProfiles = [];
  let currentProfile = null;
  let currentSettings = { showFloatingWidget: true, autoHighlight: true };
  let currentPreferences = { phoneFormat: 'adaptive', stateFormat: 'adaptive' };
  let currentSiteRules = [];

  // DOM Elements
  const activeProfileSelect = document.getElementById('active-profile-select');
  const addProfileBtn = document.getElementById('add-profile-btn');
  const renameProfileBtn = document.getElementById('rename-profile-btn');
  const deleteProfileBtn = document.getElementById('delete-profile-btn');
  const saveProfileBtn = document.getElementById('save-profile-btn');
  const saveStatus = document.getElementById('save-status');
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const tabHeading = document.getElementById('tab-heading');
  const tabSubheading = document.getElementById('tab-subheading');
  const customFieldsContainer = document.getElementById('custom-fields-container');
  const addCustomFieldBtn = document.getElementById('add-custom-field-btn');
  const settingFloatingWidget = document.getElementById('setting-floating-widget');
  const settingHighlightFields = document.getElementById('setting-highlight-fields');
  const prefPhoneFormat = document.getElementById('pref-phoneFormat');
  const prefStateFormat = document.getElementById('pref-stateFormat');
  const siteRulesList = document.getElementById('site-rules-list');
  const addSiteRuleBtn = document.getElementById('add-site-rule-btn');
  const ruleDomain = document.getElementById('rule-domain');
  const rulePhoneFormat = document.getElementById('rule-phoneFormat');
  const ruleStateFormat = document.getElementById('rule-stateFormat');
  const exportJsonBtn = document.getElementById('export-json-btn');
  const importJsonInput = document.getElementById('import-json-input');
  const resetDefaultsBtn = document.getElementById('reset-defaults-btn');
  const optionsToast = document.getElementById('options-toast');

  const TAB_INFO = {
    personal: { title: 'Personal Information', sub: 'Configure your essential contact coordinates, phone format, and state.' },
    links: { title: 'Links & Socials', sub: 'Store your professional portfolio, LinkedIn, GitHub, and social handles.' },
    experience: { title: 'Education & Work Experience', sub: 'Input your academic degrees, graduation years, and career history.' },
    compliance: { title: 'Work Authorization & Compliance', sub: 'Pre-configure common legal work status, visas, and EEOC diversity choices.' },
    custom: { title: 'Q&A & Custom Application Fields', sub: 'Short answer responses and custom field keyword mappings.' },
    siterules: { title: 'Website Rules (Overrides)', sub: 'Define domain-specific phone and state rules for platforms like Workday, Greenhouse, or Lever.' },
    settings: { title: 'Extension Preferences & Backup', sub: 'Manage floating pill visibility, field highlighting, and JSON backups.' }
  };

  // 1. Initialize State
  async function init() {
    const state = await window.AppFillerStorage.getInitialState();
    allProfiles = state.profiles;
    currentSettings = state.settings || currentSettings;
    currentPreferences = state.preferences || currentPreferences;
    currentSiteRules = state.siteRules || [];

    // Load Settings into toggles
    settingFloatingWidget.checked = currentSettings.showFloatingWidget !== false;
    settingHighlightFields.checked = currentSettings.autoHighlight !== false;

    // Load Preferences
    if (prefPhoneFormat) prefPhoneFormat.value = currentPreferences.phoneFormat || 'adaptive';
    if (prefStateFormat) prefStateFormat.value = currentPreferences.stateFormat || 'adaptive';

    renderProfileSelector(state.activeProfileId);
    selectProfile(state.activeProfileId);
    renderSiteRules();
  }

  // 2. Render Profiles Dropdown
  function renderProfileSelector(selectedId) {
    activeProfileSelect.innerHTML = '';
    allProfiles.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === selectedId) opt.selected = true;
      activeProfileSelect.appendChild(opt);
    });
  }

  // 3. Switch Selected Profile
  function selectProfile(profileId) {
    currentProfile = allProfiles.find((p) => p.id === profileId) || allProfiles[0];
    if (!currentProfile) return;

    activeProfileSelect.value = currentProfile.id;
    populateForm(currentProfile);
    markSaved();
  }

  // 4. Populate Form fields with Profile Data
  function populateForm(profile) {
    const p = profile.personal || {};
    setVal('personal-firstName', p.firstName);
    setVal('personal-lastName', p.lastName);
    setVal('personal-fullName', p.fullName);
    setVal('personal-email', p.email);
    setVal('personal-phone', p.phone);
    setVal('personal-address1', p.address1);
    setVal('personal-address2', p.address2);
    setVal('personal-city', p.city);
    setVal('personal-state', p.state);
    setVal('personal-stateCode', p.stateCode || (window.AppFillerMatcher ? window.AppFillerMatcher.resolveState(p.state).code : 'CA'));
    setVal('personal-postalCode', p.postalCode);
    setVal('personal-country', p.country);

    const l = profile.links || {};
    setVal('links-linkedin', l.linkedin);
    setVal('links-github', l.github);
    setVal('links-portfolio', l.portfolio);
    setVal('links-twitter', l.twitter);
    setVal('links-website', l.website);

    const e = profile.education || {};
    setVal('education-school', e.school);
    setVal('education-degree', e.degree);
    setVal('education-major', e.major);
    setVal('education-gpa', e.gpa);
    setVal('education-gradYear', e.gradYear);
    setVal('education-gradMonth', e.gradMonth);

    const w = profile.work || {};
    setVal('work-currentTitle', w.currentTitle);
    setVal('work-currentCompany', w.currentCompany);
    setVal('work-yearsExperience', w.yearsExperience);
    setVal('work-currentSalary', w.currentSalary);
    setVal('work-expectedSalary', w.expectedSalary);
    setVal('work-noticePeriod', w.noticePeriod);
    setVal('work-summary', w.summary);

    const a = profile.authorization || {};
    setVal('auth-authorizedUS', a.authorizedUS || 'Yes');
    setVal('auth-requireSponsorship', a.requireSponsorship || 'No');
    setVal('auth-sponsorshipDetails', a.sponsorshipDetails);
    setVal('auth-veteranStatus', a.veteranStatus || 'I am not a protected veteran');
    setVal('auth-disabilityStatus', a.disabilityStatus || 'No, I do not have a disability');
    setVal('auth-gender', a.gender || 'Decline to self-identify');
    setVal('auth-race', a.race || 'Decline to self-identify');

    const q = profile.qa || {};
    setVal('qa-tellMeAboutYourself', q.tellMeAboutYourself);
    setVal('qa-whyThisCompany', q.whyThisCompany);
    setVal('qa-greatestStrength', q.greatestStrength);

    // Custom Fields
    renderCustomFields(profile.customFields || []);
  }

  function setVal(id, val) {
    const el = document.getElementById(id);
    if (el) {
      el.value = val != null ? val : '';
    }
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  }

  // Auto-resolve State Code when State Name is edited
  const personalStateInput = document.getElementById('personal-state');
  if (personalStateInput) {
    personalStateInput.addEventListener('blur', () => {
      const stateVal = personalStateInput.value.trim();
      if (stateVal && window.AppFillerMatcher) {
        const resolved = window.AppFillerMatcher.resolveState(stateVal);
        if (resolved.code) {
          const codeInput = document.getElementById('personal-stateCode');
          if (codeInput && !codeInput.value) {
            codeInput.value = resolved.code;
          }
        }
      }
    });
  }

  // 5. Custom Fields Rendering
  function renderCustomFields(fields) {
    customFieldsContainer.innerHTML = '';
    fields.forEach((field, index) => {
      addCustomFieldRow(field.key, field.value, index);
    });

    if (fields.length === 0) {
      customFieldsContainer.innerHTML = `
        <div style="color: var(--text-muted); font-size: 13px; font-style: italic; padding: 8px 0;">
          No custom fields added yet. Click "+ Add Field" above to create custom question mappings.
        </div>
      `;
    }
  }

  function addCustomFieldRow(key = '', value = '') {
    if (customFieldsContainer.querySelector('div[style*="font-style: italic"]')) {
      customFieldsContainer.innerHTML = '';
    }

    const row = document.createElement('div');
    row.className = 'custom-field-row';
    row.innerHTML = `
      <input type="text" class="custom-key-input" placeholder="Field keyword (e.g. Desired Start Date)" value="${escapeHtml(key)}">
      <input type="text" class="custom-val-input" placeholder="Value to fill (e.g. Immediately)" value="${escapeHtml(value)}">
      <button type="button" class="custom-field-del-btn" title="Remove Field">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;

    row.querySelector('.custom-field-del-btn').addEventListener('click', () => {
      row.remove();
      markUnsaved();
    });

    row.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', markUnsaved);
    });

    customFieldsContainer.appendChild(row);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/"/g, '&quot;');
  }

  addCustomFieldBtn.addEventListener('click', () => {
    addCustomFieldRow();
    markUnsaved();
  });

  // 6. Site Rules Manager
  function renderSiteRules() {
    if (!siteRulesList) return;
    siteRulesList.innerHTML = '';

    if (currentSiteRules.length === 0) {
      siteRulesList.innerHTML = `
        <div style="color: var(--text-muted); font-size: 13px; font-style: italic; padding: 12px 0;">
          No website rules defined yet. Add one above to customize behavior for a specific domain!
        </div>
      `;
      return;
    }

    currentSiteRules.forEach((rule) => {
      const item = document.createElement('div');
      item.className = 'site-rule-item';
      item.innerHTML = `
        <div class="site-rule-main">
          <div class="site-rule-domain">
            <span>🌐 ${escapeHtml(rule.domain)}</span>
          </div>
          <div class="site-rule-tags">
            <span class="site-rule-tag">Phone: ${escapeHtml(rule.phoneFormat || 'adaptive')}</span>
            <span class="site-rule-tag">State: ${escapeHtml(rule.stateFormat || 'adaptive')}</span>
            ${rule.note ? `<span style="font-size: 11px; color: var(--text-muted); margin-left: 6px;">${escapeHtml(rule.note)}</span>` : ''}
          </div>
        </div>
        <button type="button" class="mini-btn danger del-rule-btn" data-domain="${escapeHtml(rule.domain)}">Delete</button>
      `;

      item.querySelector('.del-rule-btn').addEventListener('click', async () => {
        currentSiteRules = await window.AppFillerStorage.deleteSiteRule(rule.domain);
        renderSiteRules();
        showToast(`Deleted rule for ${rule.domain}`);
      });

      siteRulesList.appendChild(item);
    });
  }

  if (addSiteRuleBtn) {
    addSiteRuleBtn.addEventListener('click', async () => {
      let domain = ruleDomain.value.trim().toLowerCase();
      if (!domain) {
        alert('Please enter a website domain (e.g. workday.com or lever.co).');
        return;
      }
      // Clean domain (remove http://, https://, trailing slashes)
      domain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');

      const newRule = {
        domain,
        phoneFormat: rulePhoneFormat.value,
        stateFormat: ruleStateFormat.value,
        note: `Custom rule for ${domain}`
      };

      currentSiteRules = await window.AppFillerStorage.saveSiteRule(newRule);
      ruleDomain.value = '';
      renderSiteRules();
      showToast(`✨ Saved rule for ${domain}!`);
    });
  }

  // 7. Save Profile & Preferences
  async function saveCurrentProfile() {
    if (!currentProfile) return;

    // Build profile object from form
    currentProfile.personal = {
      firstName: getVal('personal-firstName'),
      lastName: getVal('personal-lastName'),
      fullName: getVal('personal-fullName') || `${getVal('personal-firstName')} ${getVal('personal-lastName')}`.trim(),
      email: getVal('personal-email'),
      phone: getVal('personal-phone'),
      address1: getVal('personal-address1'),
      address2: getVal('personal-address2'),
      city: getVal('personal-city'),
      state: getVal('personal-state'),
      stateCode: getVal('personal-stateCode'),
      postalCode: getVal('personal-postalCode'),
      country: getVal('personal-country')
    };

    currentProfile.links = {
      linkedin: getVal('links-linkedin'),
      github: getVal('links-github'),
      portfolio: getVal('links-portfolio'),
      twitter: getVal('links-twitter'),
      website: getVal('links-website')
    };

    currentProfile.education = {
      school: getVal('education-school'),
      degree: getVal('education-degree'),
      major: getVal('education-major'),
      gpa: getVal('education-gpa'),
      gradYear: getVal('education-gradYear'),
      gradMonth: getVal('education-gradMonth')
    };

    currentProfile.work = {
      currentTitle: getVal('work-currentTitle'),
      currentCompany: getVal('work-currentCompany'),
      yearsExperience: getVal('work-yearsExperience'),
      currentSalary: getVal('work-currentSalary'),
      expectedSalary: getVal('work-expectedSalary'),
      noticePeriod: getVal('work-noticePeriod'),
      summary: getVal('work-summary')
    };

    currentProfile.authorization = {
      authorizedUS: getVal('auth-authorizedUS'),
      requireSponsorship: getVal('auth-requireSponsorship'),
      sponsorshipDetails: getVal('auth-sponsorshipDetails'),
      veteranStatus: getVal('auth-veteranStatus'),
      disabilityStatus: getVal('auth-disabilityStatus'),
      gender: getVal('auth-gender'),
      race: getVal('auth-race')
    };

    currentProfile.qa = {
      tellMeAboutYourself: getVal('qa-tellMeAboutYourself'),
      whyThisCompany: getVal('qa-whyThisCompany'),
      greatestStrength: getVal('qa-greatestStrength')
    };

    // Gather custom fields
    const customFields = [];
    const rows = customFieldsContainer.querySelectorAll('.custom-field-row');
    rows.forEach((row) => {
      const k = row.querySelector('.custom-key-input').value.trim();
      const v = row.querySelector('.custom-val-input').value.trim();
      if (k) {
        customFields.push({ key: k, value: v });
      }
    });
    currentProfile.customFields = customFields;

    // Save profile to storage
    await window.AppFillerStorage.saveProfile(currentProfile);

    // Save settings & preferences
    currentSettings.showFloatingWidget = settingFloatingWidget.checked;
    currentSettings.autoHighlight = settingHighlightFields.checked;
    await window.AppFillerStorage.updateSettings(currentSettings);

    currentPreferences.phoneFormat = prefPhoneFormat.value;
    currentPreferences.stateFormat = prefStateFormat.value;
    await window.AppFillerStorage.updatePreferences(currentPreferences);

    markSaved();
    showToast('✨ Profile, preferences, and site rules saved successfully!');
  }

  saveProfileBtn.addEventListener('click', saveCurrentProfile);

  // Profile Switching & Creation
  activeProfileSelect.addEventListener('change', async () => {
    const id = activeProfileSelect.value;
    await window.AppFillerStorage.setActiveProfileId(id);
    selectProfile(id);
  });

  addProfileBtn.addEventListener('click', async () => {
    const name = prompt('Enter a name for the new profile (e.g. "Designer Profile", "Secondary"):');
    if (!name || !name.trim()) return;

    const newProfile = await window.AppFillerStorage.createProfile(name.trim());
    allProfiles.push(newProfile);
    renderProfileSelector(newProfile.id);
    selectProfile(newProfile.id);
    showToast(`Created profile "${newProfile.name}"!`);
  });

  renameProfileBtn.addEventListener('click', async () => {
    if (!currentProfile) return;
    const newName = prompt('Enter new name for this profile:', currentProfile.name);
    if (!newName || !newName.trim() || newName.trim() === currentProfile.name) return;

    currentProfile.name = newName.trim();
    await window.AppFillerStorage.saveProfile(currentProfile);
    renderProfileSelector(currentProfile.id);
    showToast(`Renamed profile to "${currentProfile.name}"`);
  });

  deleteProfileBtn.addEventListener('click', async () => {
    if (!currentProfile) return;
    if (allProfiles.length <= 1) {
      alert('You cannot delete the only profile.');
      return;
    }

    if (!confirm(`Are you sure you want to delete profile "${currentProfile.name}"?`)) {
      return;
    }

    const { profiles, activeProfileId } = await window.AppFillerStorage.deleteProfile(currentProfile.id);
    allProfiles = profiles;
    renderProfileSelector(activeProfileId);
    selectProfile(activeProfileId);
    showToast('Profile deleted.');
  });

  // Tab Switching
  navItems.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.dataset.tab;
      navItems.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPane = document.getElementById(`tab-${tabKey}`);
      if (targetPane) targetPane.classList.add('active');

      if (TAB_INFO[tabKey]) {
        tabHeading.textContent = TAB_INFO[tabKey].title;
        tabSubheading.textContent = TAB_INFO[tabKey].sub;
      }
    });
  });

  // Track Unsaved Changes
  document.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('input', markUnsaved);
    el.addEventListener('change', markUnsaved);
  });

  function markUnsaved() {
    saveStatus.textContent = 'Unsaved changes';
    saveStatus.style.color = '#fbbf24';
  }

  function markSaved() {
    saveStatus.textContent = 'All changes saved';
    saveStatus.style.color = 'var(--accent-emerald)';
  }

  // Backup & Restore
  exportJsonBtn.addEventListener('click', async () => {
    const state = await window.AppFillerStorage.getInitialState();
    const jsonStr = JSON.stringify(state, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `autofill-pro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported profiles and rules to JSON file!');
  });

  importJsonInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!imported.profiles || !Array.isArray(imported.profiles)) {
          alert('Invalid backup format: missing profiles array.');
          return;
        }

        chrome.storage.local.set(
          {
            profiles: imported.profiles,
            activeProfileId: imported.activeProfileId || imported.profiles[0].id,
            settings: imported.settings || currentSettings,
            siteRules: imported.siteRules || currentSiteRules,
            preferences: imported.preferences || currentPreferences
          },
          () => {
            showToast('Backup imported successfully!');
            setTimeout(() => window.location.reload(), 1000);
          }
        );
      } catch (err) {
        alert('Could not parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  resetDefaultsBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to reset to factory defaults? All custom profiles and site rules will be removed.')) {
      chrome.storage.local.clear(() => {
        showToast('Reset complete.');
        setTimeout(() => window.location.reload(), 800);
      });
    }
  });

  function showToast(msg) {
    optionsToast.textContent = msg;
    optionsToast.classList.remove('hidden');
    setTimeout(() => {
      optionsToast.classList.add('hidden');
    }, 2800);
  }

  // Initialize
  init();
});

/**
 * AutoFill Pro - Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
  const profileSelect = document.getElementById('profile-select');
  const autofillBtn = document.getElementById('autofill-btn');
  const openOptionsBtn = document.getElementById('open-options-btn');
  const footerOptionsLink = document.getElementById('footer-options-link');
  const pageStatusText = document.getElementById('page-status-text');
  const fieldCountBadge = document.getElementById('field-count-badge');
  const siteRuleBanner = document.getElementById('site-rule-banner');
  const siteRuleText = document.getElementById('site-rule-text');
  const popupToast = document.getElementById('popup-toast');
  const copyChips = document.querySelectorAll('.copy-chip');

  let activeProfile = null;
  let activeTab = null;

  // 1. Get active tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tabs[0];
  } catch (err) {
    console.error('Error fetching active tab:', err);
  }

  // 2. Load Profiles into dropdown
  async function loadProfiles() {
    const state = await window.AppFillerStorage.getInitialState();
    profileSelect.innerHTML = '';
    state.profiles.forEach((p) => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      if (p.id === state.activeProfileId) {
        opt.selected = true;
      }
      profileSelect.appendChild(opt);
    });
    activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
  }

  await loadProfiles();

  // Profile selection change
  profileSelect.addEventListener('change', async () => {
    const selectedId = profileSelect.value;
    await window.AppFillerStorage.setActiveProfileId(selectedId);
    activeProfile = await window.AppFillerStorage.getActiveProfile();
    showToast(`Switched to "${activeProfile.name}"`);
  });

  // 3. Query active tab for form stats and site rules
  async function queryTabStats() {
    if (!activeTab || !activeTab.id || !activeTab.url || activeTab.url.startsWith('chrome://')) {
      pageStatusText.textContent = 'Chrome internal page';
      fieldCountBadge.textContent = '0 Fields';
      fieldCountBadge.style.color = '#94a3b8';
      fieldCountBadge.style.borderColor = 'rgba(255, 255, 255, 0.1)';
      siteRuleBanner.classList.add('hidden');
      return;
    }

    try {
      // Check site rule for active tab hostname
      const url = new URL(activeTab.url);
      const rule = await window.AppFillerStorage.getRuleForDomain(url.hostname);
      if (rule) {
        siteRuleBanner.classList.remove('hidden');
        siteRuleText.textContent = `Rule Active: ${rule.domain} (Phone: ${rule.phoneFormat || 'auto'}, State: ${rule.stateFormat || 'auto'})`;
      } else {
        siteRuleBanner.classList.add('hidden');
      }

      chrome.tabs.sendMessage(activeTab.id, { action: 'GET_PAGE_STATS' }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          pageStatusText.textContent = 'Form ready for autofill';
          fieldCountBadge.textContent = 'Scan ready';
        } else {
          fieldCountBadge.textContent = `${resp.count} Field${resp.count === 1 ? '' : 's'}`;
          if (resp.count > 0) {
            pageStatusText.textContent = 'Application fields detected';
          } else {
            pageStatusText.textContent = 'No input fields detected';
            fieldCountBadge.style.color = '#94a3b8';
          }
        }
      });
    } catch (e) {
      pageStatusText.textContent = 'Ready to fill';
    }
  }

  queryTabStats();

  // 4. Autofill Button click
  autofillBtn.addEventListener('click', async () => {
    if (!activeTab || !activeTab.id) return;

    autofillBtn.disabled = true;
    autofillBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"/>
      </svg>
      <span>Filling Fields...</span>
    `;

    try {
      chrome.tabs.sendMessage(activeTab.id, { action: 'AUTOFILL_PAGE', profile: activeProfile }, async (resp) => {
        if (chrome.runtime.lastError) {
          try {
            await chrome.scripting.insertCSS({
              target: { tabId: activeTab.id },
              files: ['content/content.css']
            });
            await chrome.scripting.executeScript({
              target: { tabId: activeTab.id },
              files: ['utils/storage.js', 'utils/matcher.js', 'content/content.js']
            });

            chrome.tabs.sendMessage(activeTab.id, { action: 'AUTOFILL_PAGE', profile: activeProfile }, (retryResp) => {
              handleAutofillResponse(retryResp);
            });
          } catch (injectErr) {
            console.error('Injection failed:', injectErr);
            showToast('⚠️ Cannot autofill this page.', true);
            resetAutofillBtn();
          }
        } else {
          handleAutofillResponse(resp);
        }
      });
    } catch (err) {
      console.error(err);
      resetAutofillBtn();
    }
  });

  function handleAutofillResponse(resp) {
    resetAutofillBtn();
    if (resp && resp.success) {
      if (resp.count > 0) {
        showToast(`✨ Success! Filled ${resp.count} field${resp.count === 1 ? '' : 's'}.`);
      } else {
        showToast(`Found ${resp.total || 0} fields, but none matched profile.`);
      }
    } else {
      showToast('⚠️ Autofill could not complete.');
    }
    queryTabStats();
  }

  function resetAutofillBtn() {
    autofillBtn.disabled = false;
    autofillBtn.innerHTML = `
      <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      <span>Autofill Form Now</span>
    `;
  }

  // 5. Quick Copy Chips
  copyChips.forEach((chip) => {
    chip.addEventListener('click', async () => {
      if (!activeProfile) return;

      const type = chip.dataset.copy;
      let textToCopy = '';

      const phoneData = window.AppFillerMatcher ? window.AppFillerMatcher.parsePhoneNumber(activeProfile.personal?.phone || '') : {};
      const stateData = window.AppFillerMatcher ? window.AppFillerMatcher.resolveState(activeProfile.personal?.state || 'California') : {};

      switch (type) {
        case 'phone_digits':
          textToCopy = phoneData.digits || activeProfile.personal?.phone || '';
          break;
        case 'phone_fmt':
          textToCopy = phoneData.national || activeProfile.personal?.phone || '';
          break;
        case 'state_code':
          textToCopy = stateData.code || activeProfile.personal?.stateCode || 'CA';
          break;
        case 'linkedin':
          textToCopy = activeProfile.links?.linkedin || '';
          break;
        case 'github':
          textToCopy = activeProfile.links?.github || '';
          break;
        case 'email':
          textToCopy = activeProfile.personal?.email || '';
          break;
        case 'portfolio':
          textToCopy = activeProfile.links?.portfolio || '';
          break;
        case 'bio':
          textToCopy = activeProfile.qa?.tellMeAboutYourself || activeProfile.work?.summary || '';
          break;
      }

      if (!textToCopy) {
        showToast(`No data saved in this profile`, true);
        return;
      }

      try {
        await navigator.clipboard.writeText(textToCopy);
        const originalText = chip.querySelector('span').textContent;
        chip.classList.add('copied');
        chip.querySelector('span').textContent = 'Copied!';
        showToast(`Copied: ${textToCopy}`);

        setTimeout(() => {
          chip.classList.remove('copied');
          chip.querySelector('span').textContent = originalText;
        }, 1500);
      } catch (e) {
        showToast('Failed to copy', true);
      }
    });
  });

  // 6. Open Options page
  function openOptions() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  }

  openOptionsBtn.addEventListener('click', openOptions);
  footerOptionsLink.addEventListener('click', openOptions);

  function showToast(msg, isError = false) {
    popupToast.textContent = msg;
    popupToast.classList.remove('hidden');
    popupToast.style.borderColor = isError ? '#ef4444' : '#10b981';
    popupToast.style.color = isError ? '#f87171' : '#34d399';

    setTimeout(() => {
      popupToast.classList.add('hidden');
    }, 2500);
  }
});

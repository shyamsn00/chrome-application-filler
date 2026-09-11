/**
 * Chrome Application Filler - Content Script
 * Executes on web pages to detect and fill form inputs with site rules and adaptive formatting.
 */

(function () {
  // Prevent double injection
  if (window.__appFillerLoaded) return;
  window.__appFillerLoaded = true;

  let settingsCache = { showFloatingWidget: true, autoHighlight: true };

  /**
   * Scans document and returns all viable form control elements.
   */
  function getCandidateElements() {
    const selector = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), textarea, select';
    return Array.from(document.querySelectorAll(selector)).filter((el) => {
      // Must not be disabled or hidden via style
      if (el.disabled || el.readOnly) return false;
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      return true;
    });
  }

  /**
   * Counts detectable form fields on current page.
   */
  function countDetectableFields() {
    return getCandidateElements().length;
  }

  /**
   * Performs autofill over all candidate elements using the given profile, site rule, and preferences.
   */
  async function performAutofill(profileOverride) {
    let profile = profileOverride;
    let siteRule = null;
    let preferences = { phoneFormat: 'adaptive', stateFormat: 'adaptive' };

    if (window.AppFillerStorage) {
      if (!profile) {
        profile = await window.AppFillerStorage.getActiveProfile();
      }
      siteRule = await window.AppFillerStorage.getRuleForDomain(window.location.hostname);
      preferences = await window.AppFillerStorage.getPreferences();
    } else {
      // Fallback message to background
      const res = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'GET_ACTIVE_PROFILE', hostname: window.location.hostname }, (resp) => {
          resolve(resp || {});
        });
      });
      if (!profile) profile = res.profile;
      siteRule = res.siteRule;
      preferences = res.preferences || preferences;
    }

    if (!profile) {
      showToast('⚠️ No active profile found. Please set up a profile first.', 'warning');
      return { success: false, count: 0 };
    }

    const elements = getCandidateElements();
    let filledCount = 0;
    const filledElements = [];

    // Separate two passes:
    // Pass 1: Handle Country and Work Authorization first (so state dropdowns populate if dependent)
    // Pass 2: Handle remaining fields including State, Phone, etc.
    const priorityFields = [];
    const normalFields = [];

    for (const el of elements) {
      const clues = window.AppFillerMatcher ? window.AppFillerMatcher.getFieldClues(el) : '';
      if (/country|nation/i.test(clues)) {
        priorityFields.push(el);
      } else {
        normalFields.push(el);
      }
    }

    const orderedElements = [...priorityFields, ...normalFields];

    for (const el of orderedElements) {
      if (!window.AppFillerMatcher) continue;
      const match = window.AppFillerMatcher.matchField(el, profile, siteRule, preferences);
      if (match && match.value != null) {
        const changed = window.AppFillerMatcher.setElementValue(el, match);
        if (changed) {
          filledCount++;
          filledElements.push(el);
          if (settingsCache.autoHighlight) {
            el.classList.add('app-filler-highlight');
          }
        }
      }
    }

    if (filledCount > 0) {
      const ruleNote = siteRule ? ` (Rule: ${siteRule.domain})` : '';
      showToast(`✨ AutoFill Pro: Filled ${filledCount} field${filledCount > 1 ? 's' : ''}!${ruleNote}`, 'success');
      
      // Remove highlights after 3.5 seconds
      setTimeout(() => {
        filledElements.forEach((el) => {
          el.classList.remove('app-filler-highlight');
        });
      }, 3500);
    } else {
      showToast(`🔍 Scanned ${elements.length} field${elements.length === 1 ? '' : 's'}, but found no matching profile fields.`, 'info');
    }

    return { success: true, count: filledCount, total: elements.length, siteRule };
  }

  /**
   * Displays temporary modern toast notification
   */
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.app-filler-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'app-filler-toast';

    let icon = '⚡';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'info') icon = 'ℹ️';

    toast.innerHTML = `
      <span style="font-size: 16px;">${icon}</span>
      <span style="font-weight: 500;">${message}</span>
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }
    }, 3800);
  }

  /**
   * Injects the floating widget if enabled and page contains forms
   */
  async function maybeInjectFloatingWidget() {
    if (document.getElementById('app-filler-floating-widget')) return;

    if (window.AppFillerStorage) {
      const settings = await window.AppFillerStorage.getSettings();
      settingsCache = settings;
      if (!settings.showFloatingWidget) return;
    }

    const fieldCount = countDetectableFields();
    const isAppSite = /greenhouse|lever|workday|ashby|icims|smartrecruiters|taleo|bamboohr|jobvite|apply|career|job/i.test(
      window.location.href
    );

    if (fieldCount < 2 && !isAppSite) return;

    let profile = null;
    let siteRule = null;
    if (window.AppFillerStorage) {
      profile = await window.AppFillerStorage.getActiveProfile();
      siteRule = await window.AppFillerStorage.getRuleForDomain(window.location.hostname);
    }

    const subtitleText = siteRule ? `Rule: ${siteRule.domain}` : (profile ? profile.name : 'Ready to fill');

    const widget = document.createElement('div');
    widget.id = 'app-filler-floating-widget';
    widget.innerHTML = `
      <div class="app-filler-pill" title="Click to autofill application with AutoFill Pro">
        <div class="app-filler-logo">
          <svg viewBox="0 0 24 24">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <div class="app-filler-content">
          <div class="app-filler-title">
            <span>AutoFill Pro</span>
            <span class="app-filler-badge">${fieldCount} Fields</span>
          </div>
          <div class="app-filler-subtitle">${subtitleText}</div>
        </div>
        <button class="app-filler-btn" id="app-filler-quick-btn" title="Autofill Now">
          <span>Fill</span>
        </button>
        <button class="app-filler-close" id="app-filler-close-btn" title="Dismiss">×</button>
      </div>
    `;

    document.body.appendChild(widget);

    // Event listeners
    const quickBtn = widget.querySelector('#app-filler-quick-btn');
    const closeBtn = widget.querySelector('#app-filler-close-btn');
    const pill = widget.querySelector('.app-filler-pill');

    quickBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      performAutofill();
    });

    pill.addEventListener('click', () => {
      performAutofill();
    });

    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      widget.remove();
    });
  }

  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'AUTOFILL_PAGE') {
      performAutofill(request.profile).then((result) => {
        sendResponse(result);
      });
      return true;
    }

    if (request.action === 'GET_PAGE_STATS') {
      let siteRulePromise = Promise.resolve(null);
      if (window.AppFillerStorage) {
        siteRulePromise = window.AppFillerStorage.getRuleForDomain(window.location.hostname);
      }
      siteRulePromise.then((rule) => {
        sendResponse({
          count: countDetectableFields(),
          url: window.location.href,
          hostname: window.location.hostname,
          siteRule: rule,
          title: document.title
        });
      });
      return true;
    }

    if (request.action === 'INSERT_VALUE_IN_ACTIVE') {
      const active = document.activeElement;
      if (active && window.AppFillerMatcher) {
        window.AppFillerMatcher.setElementValue(active, request.value);
        if (settingsCache.autoHighlight) {
          active.classList.add('app-filler-highlight');
          setTimeout(() => active.classList.remove('app-filler-highlight'), 3000);
        }
        showToast(`Inserted: ${request.value}`, 'success');
      }
      sendResponse({ status: 'ok' });
      return false;
    }

    if (request.action === 'PING') {
      sendResponse({ status: 'ok' });
      return false;
    }
  });

  // Wait for DOM ready then check for widget
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(maybeInjectFloatingWidget, 1000);
    });
  } else {
    setTimeout(maybeInjectFloatingWidget, 1000);
  }

  // Periodic check if form dynamically loaded (e.g. SPAs, Workday, Greenhouse modal)
  let checkCount = 0;
  const intervalId = setInterval(() => {
    checkCount++;
    if (checkCount > 5) clearInterval(intervalId);
    if (!document.getElementById('app-filler-floating-widget')) {
      maybeInjectFloatingWidget();
    }
  }, 2000);
})();

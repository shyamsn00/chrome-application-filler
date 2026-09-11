/**
 * Chrome Application Filler - Background Service Worker
 * Manages context menus, keyboard shortcuts, site rules, and extension lifecycle.
 */

// Import storage utility in service worker context
importScripts('../utils/storage.js');
importScripts('../utils/matcher.js');

chrome.runtime.onInstalled.addListener(async () => {
  console.log('AutoFill Pro installed/updated.');

  // Initialize storage defaults
  await AppFillerStorage.getInitialState();

  setupContextMenus();
});

function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    // Root menu
    chrome.contextMenus.create({
      id: 'app_filler_root',
      title: 'AutoFill Pro',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'app_filler_autofill',
      parentId: 'app_filler_root',
      title: '⚡ Autofill Entire Application Form',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'app_filler_sep_1',
      parentId: 'app_filler_root',
      type: 'separator',
      contexts: ['all']
    });

    // Quick Insert submenu for currently focused field
    chrome.contextMenus.create({
      id: 'app_filler_insert_sub',
      parentId: 'app_filler_root',
      title: '✍️ Insert into This Field',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'app_filler_ins_phone_digits',
      parentId: 'app_filler_insert_sub',
      title: 'Phone (10 Digits Only)',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'app_filler_ins_phone_fmt',
      parentId: 'app_filler_insert_sub',
      title: 'Phone ((555) 349-2810)',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'app_filler_ins_state_code',
      parentId: 'app_filler_insert_sub',
      title: 'State Code (e.g. CA)',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'app_filler_ins_state_name',
      parentId: 'app_filler_insert_sub',
      title: 'State Name (e.g. California)',
      contexts: ['editable']
    });

    chrome.contextMenus.create({
      id: 'app_filler_sep_2',
      parentId: 'app_filler_root',
      type: 'separator',
      contexts: ['all']
    });

    // Quick Copy items
    chrome.contextMenus.create({
      id: 'app_filler_copy_phone_10',
      parentId: 'app_filler_root',
      title: '📋 Copy Phone (10 Digits)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'app_filler_copy_phone_fmt',
      parentId: 'app_filler_root',
      title: '📋 Copy Phone (Formatted)',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'app_filler_copy_linkedin',
      parentId: 'app_filler_root',
      title: '📋 Copy LinkedIn URL',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'app_filler_copy_github',
      parentId: 'app_filler_root',
      title: '📋 Copy GitHub URL',
      contexts: ['all']
    });

    chrome.contextMenus.create({
      id: 'app_filler_copy_email',
      parentId: 'app_filler_root',
      title: '📋 Copy Email Address',
      contexts: ['all']
    });
  });
}

// Handle Context Menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab || !tab.id) return;

  const profile = await AppFillerStorage.getActiveProfile();
  const phoneData = AppFillerMatcher.parsePhoneNumber(profile.personal?.phone || '');
  const stateData = AppFillerMatcher.resolveState(profile.personal?.state || 'California');

  // Autofill full page
  if (info.menuItemId === 'app_filler_autofill') {
    chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL_PAGE', profile }, (response) => {
      if (chrome.runtime.lastError) {
        console.warn('Could not communicate with tab:', chrome.runtime.lastError.message);
      }
    });
    return;
  }

  // Insert value into active input
  if (info.menuItemId.startsWith('app_filler_ins_')) {
    let insertVal = '';
    if (info.menuItemId === 'app_filler_ins_phone_digits') insertVal = phoneData.digits;
    if (info.menuItemId === 'app_filler_ins_phone_fmt') insertVal = phoneData.national;
    if (info.menuItemId === 'app_filler_ins_state_code') insertVal = stateData.code;
    if (info.menuItemId === 'app_filler_ins_state_name') insertVal = stateData.name;

    if (insertVal) {
      chrome.tabs.sendMessage(tab.id, { action: 'INSERT_VALUE_IN_ACTIVE', value: insertVal });
    }
    return;
  }

  // Copy to clipboard
  if (info.menuItemId.startsWith('app_filler_copy_')) {
    let copyText = '';
    if (info.menuItemId === 'app_filler_copy_phone_10') copyText = phoneData.digits;
    if (info.menuItemId === 'app_filler_copy_phone_fmt') copyText = phoneData.national;
    if (info.menuItemId === 'app_filler_copy_linkedin') copyText = profile.links?.linkedin || '';
    if (info.menuItemId === 'app_filler_copy_github') copyText = profile.links?.github || '';
    if (info.menuItemId === 'app_filler_copy_email') copyText = profile.personal?.email || '';

    if (copyText) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (text) => {
          navigator.clipboard.writeText(text);
        },
        args: [copyText]
      });
    }
  }
});

// Handle global keyboard commands (Alt+Shift+F)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'autofill-active-page') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const profile = await AppFillerStorage.getActiveProfile();
      chrome.tabs.sendMessage(tab.id, { action: 'AUTOFILL_PAGE', profile });
    }
  }
});

// Handle direct message requests from content scripts or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'GET_ACTIVE_PROFILE') {
    Promise.all([
      AppFillerStorage.getActiveProfile(),
      message.hostname ? AppFillerStorage.getRuleForDomain(message.hostname) : Promise.resolve(null),
      AppFillerStorage.getPreferences()
    ]).then(([profile, siteRule, preferences]) => {
      sendResponse({ profile, siteRule, preferences });
    });
    return true;
  }
});

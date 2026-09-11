# AutoFill Pro - Chrome Application Filler Extension

An intelligent Chrome extension (Manifest V3) built to autofill job applications, screening questionnaires, and web forms with one click.

Designed for popular applicant tracking systems (Greenhouse, Lever, Workday, Ashby, Taleo, iCIMS) and standard web forms.

---

## ✨ Features

- **⚡ One-Click Autofill**: Automatically fills candidate contact info, addresses, education, work experience, EEOC questions, and custom screening questions.
- **🎯 Intelligent Field Detection**: Heuristic engine inspects names, IDs, placeholders, ARIA labels, associated `<label>` text, and surrounding DOM blocks.
- **⚛️ Framework Compatible**: Dispatches native prototype setters and synthetic `input`, `change`, and `blur` events so React, Angular, and Vue forms (like Greenhouse & Lever) reliably register changes.
- **📁 Multi-Profile Support**: Switch between different profiles (e.g. *Full-Stack Developer*, *Product Manager*, *Secondary Profile*).
- **📋 Quick-Copy Drawer**: One-click clipboard copy for LinkedIn, GitHub, Portfolio, Email, Phone, and elevator pitch.
- **💬 Custom Field Mappings**: Map arbitrary question keywords (e.g. *Desired Start Date*, *Referral Source*, *Notice Period*) to your custom answers.
- **📦 JSON Backup & Restore**: Export your profiles to a `.json` backup file or restore them anytime.
- **⌨️ Keyboard Shortcut**: Press `Alt + Shift + F` on any page to autofill immediately.
- **🖱️ Context Menus**: Right-click anywhere on an application page to autofill or copy credentials.
- **💫 Floating Action Pill**: Non-intrusive floating badge on application forms for instant autofill.

---

## 🚀 How to Install in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select this folder:
   ```
   c:\Users\Shyam Senthil Nathan\Desktop\(installations)\chrome-application-filler
   ```
5. Pin **AutoFill Pro** to your Chrome toolbar for easy access.

---

## 🧪 How to Test Immediately

A pre-built sample application form is included in this repository:
1. Open Google Chrome.
2. Press `Ctrl + O` (or drag and drop) and open:
   ```
   c:\Users\Shyam Senthil Nathan\Desktop\(installations)\chrome-application-filler\test-form.html
   ```
3. Click the **AutoFill Pro** extension icon in your toolbar, or click the floating **Fill** pill, or press `Alt + Shift + F`.
4. Watch all contact details, links, education, work authorization, EEOC demographic selections, and custom questions fill instantly with a glowing green confirmation outline!

---

## 🛠️ Structure

```
chrome-application-filler/
├── manifest.json              # Manifest V3 configuration & permissions
├── background/
│   └── background.js          # Service worker for context menus, shortcuts, messaging
├── popup/
│   ├── popup.html             # Quick-action popup UI
│   ├── popup.css              # Dark mode glassmorphic styling
│   └── popup.js               # Form trigger, active profile selector, quick copy
├── options/
│   ├── options.html           # Full profile & settings manager dashboard
│   ├── options.css            # Options styling with tabs and responsive grids
│   └── options.js             # Data binding, custom fields, JSON import/export
├── content/
│   ├── content.js             # DOM scanner, field matcher, framework event dispatcher
│   └── content.css            # Floating quick-fill pill & field glow animations
├── utils/
│   ├── storage.js             # Chrome storage local wrapper & default seed profile
│   └── matcher.js             # Heuristic rules & classification engine
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── test-form.html             # Full mock job application page for instant testing
```

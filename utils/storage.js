/**
 * Chrome Application Filler - Storage Utility
 * Manages profiles, active profile state, preferences, and per-site rules using chrome.storage.local
 */

(function (root) {
  const DEFAULT_PROFILE = {
    id: 'default_primary',
    name: 'Primary Profile (Tech)',
    updatedAt: new Date().toISOString(),
    personal: {
      firstName: 'Alex',
      lastName: 'Morgan',
      fullName: 'Alex Morgan',
      email: 'alex.morgan.dev@example.com',
      phone: '(555) 349-2810',
      address1: '742 Evergreen Terrace',
      address2: 'Apt 4B',
      city: 'San Francisco',
      state: 'California',
      stateCode: 'CA',
      postalCode: '94107',
      country: 'United States',
      countryCode: 'US'
    },
    links: {
      linkedin: 'https://linkedin.com/in/alex-morgan-dev',
      github: 'https://github.com/alexmorgan-dev',
      portfolio: 'https://alexmorgan.dev',
      twitter: 'https://x.com/alexmorgan_dev',
      website: 'https://alexmorgan.dev/blog'
    },
    education: {
      school: 'University of California, Berkeley',
      degree: "Bachelor's Degree",
      major: 'Computer Science',
      gpa: '3.85',
      gradYear: '2023',
      gradMonth: 'May'
    },
    work: {
      currentTitle: 'Senior Software Engineer',
      currentCompany: 'Apex Cloud Solutions',
      yearsExperience: '5',
      noticePeriod: '2 weeks',
      currentSalary: '145000',
      expectedSalary: '165000',
      summary: 'Passionate full-stack software engineer with 5+ years of experience building resilient cloud-native applications and scalable distributed systems.'
    },
    authorization: {
      authorizedUS: 'Yes',
      requireSponsorship: 'No',
      sponsorshipDetails: 'Not required',
      veteranStatus: 'I am not a protected veteran',
      disabilityStatus: 'No, I do not have a disability',
      gender: 'Decline to self-identify',
      race: 'Decline to self-identify'
    },
    qa: {
      tellMeAboutYourself: 'I am a full-stack engineer with expertise in JavaScript, TypeScript, Python, and cloud infrastructure. I enjoy solving complex architecture problems and collaborating with cross-functional teams to build impactful products.',
      whyThisCompany: 'I have followed your product vision closely and am inspired by how you solve customer problems at scale. I would love to bring my systems engineering expertise to contribute to your mission.',
      greatestStrength: 'Strong systems thinking, rapid prototyping, and delivering robust, maintainable code with high test coverage.',
      remoteWorkPreference: 'Hybrid or Remote'
    },
    customFields: [
      { key: 'Preferred Name', value: 'Alex' },
      { key: 'Pronouns', value: 'They/Them' },
      { key: 'Desired Start Date', value: 'Immediate' }
    ]
  };

  const DEFAULT_SITE_RULES = [
    {
      domain: 'myworkdayjobs.com',
      phoneFormat: 'digits',
      stateFormat: 'code',
      note: 'Workday prefers 10 pure digits and 2-letter state codes'
    },
    {
      domain: 'greenhouse.io',
      phoneFormat: 'national',
      stateFormat: 'name',
      note: 'Greenhouse handles (555) 349-2810 standard formatting'
    },
    {
      domain: 'lever.co',
      phoneFormat: 'dashed',
      stateFormat: 'name',
      note: 'Lever handles 555-349-2810 cleanly'
    }
  ];

  const AppFillerStorage = {
    DEFAULT_PROFILE_ID: 'default_primary',

    async getInitialState() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['profiles', 'activeProfileId', 'settings', 'siteRules', 'preferences'], (result) => {
          let profiles = result.profiles;
          let activeProfileId = result.activeProfileId;
          let settings = result.settings;
          let siteRules = result.siteRules;
          let preferences = result.preferences;

          if (!profiles || !Array.isArray(profiles) || profiles.length === 0) {
            profiles = [JSON.parse(JSON.stringify(DEFAULT_PROFILE))];
            activeProfileId = DEFAULT_PROFILE.id;
          }

          if (!activeProfileId || !profiles.some((p) => p.id === activeProfileId)) {
            activeProfileId = profiles[0].id;
          }

          if (!settings) {
            settings = {
              showFloatingWidget: true,
              autoHighlight: true,
              theme: 'dark'
            };
          }

          if (!siteRules || !Array.isArray(siteRules)) {
            siteRules = DEFAULT_SITE_RULES;
          }

          if (!preferences) {
            preferences = {
              phoneFormat: 'adaptive',
              stateFormat: 'adaptive'
            };
          }

          if (!result.profiles || !result.siteRules) {
            chrome.storage.local.set({ profiles, activeProfileId, settings, siteRules, preferences });
          }

          resolve({ profiles, activeProfileId, settings, siteRules, preferences });
        });
      });
    },

    async getActiveProfile() {
      const state = await this.getInitialState();
      const active = state.profiles.find((p) => p.id === state.activeProfileId) || state.profiles[0];
      return active;
    },

    async getAllProfiles() {
      const state = await this.getInitialState();
      return state.profiles;
    },

    async saveProfile(profile) {
      const state = await this.getInitialState();
      profile.updatedAt = new Date().toISOString();
      const index = state.profiles.findIndex((p) => p.id === profile.id);

      if (index >= 0) {
        state.profiles[index] = profile;
      } else {
        state.profiles.push(profile);
      }

      return new Promise((resolve) => {
        chrome.storage.local.set({ profiles: state.profiles }, () => {
          resolve(profile);
        });
      });
    },

    async setActiveProfileId(id) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ activeProfileId: id }, () => {
          resolve(id);
        });
      });
    },

    async deleteProfile(id) {
      const state = await this.getInitialState();
      if (state.profiles.length <= 1) {
        throw new Error('Cannot delete the only remaining profile.');
      }
      const updatedProfiles = state.profiles.filter((p) => p.id !== id);
      let activeId = state.activeProfileId;
      if (activeId === id) {
        activeId = updatedProfiles[0].id;
      }
      return new Promise((resolve) => {
        chrome.storage.local.set({ profiles: updatedProfiles, activeProfileId: activeId }, () => {
          resolve({ profiles: updatedProfiles, activeProfileId: activeId });
        });
      });
    },

    async createProfile(name) {
      const state = await this.getInitialState();
      const newProfile = JSON.parse(JSON.stringify(DEFAULT_PROFILE));
      newProfile.id = 'profile_' + Date.now();
      newProfile.name = name || 'New Profile';
      newProfile.updatedAt = new Date().toISOString();
      state.profiles.push(newProfile);

      return new Promise((resolve) => {
        chrome.storage.local.set({ profiles: state.profiles, activeProfileId: newProfile.id }, () => {
          resolve(newProfile);
        });
      });
    },

    async getSettings() {
      const state = await this.getInitialState();
      return state.settings;
    },

    async updateSettings(settings) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ settings }, () => {
          resolve(settings);
        });
      });
    },

    async getPreferences() {
      const state = await this.getInitialState();
      return state.preferences;
    },

    async updatePreferences(preferences) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ preferences }, () => {
          resolve(preferences);
        });
      });
    },

    async getSiteRules() {
      const state = await this.getInitialState();
      return state.siteRules;
    },

    async getRuleForDomain(hostname) {
      if (!hostname) return null;
      const rules = await this.getSiteRules();
      const cleanHost = hostname.toLowerCase();
      return rules.find((r) => r.domain && cleanHost.includes(r.domain.toLowerCase())) || null;
    },

    async saveSiteRule(rule) {
      const state = await this.getInitialState();
      const rules = state.siteRules || [];
      const index = rules.findIndex((r) => r.domain.toLowerCase() === rule.domain.toLowerCase());

      if (index >= 0) {
        rules[index] = rule;
      } else {
        rules.push(rule);
      }

      return new Promise((resolve) => {
        chrome.storage.local.set({ siteRules: rules }, () => {
          resolve(rules);
        });
      });
    },

    async deleteSiteRule(domain) {
      const state = await this.getInitialState();
      const rules = (state.siteRules || []).filter((r) => r.domain.toLowerCase() !== domain.toLowerCase());

      return new Promise((resolve) => {
        chrome.storage.local.set({ siteRules: rules }, () => {
          resolve(rules);
        });
      });
    }
  };

  root.AppFillerStorage = AppFillerStorage;
})(typeof globalThis !== 'undefined' ? globalThis : this);

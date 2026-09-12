/**
 * Chrome Application Filler - Field Matcher & Heuristics Engine
 * Extracts field metadata and accurately maps DOM inputs to profile fields.
 * Includes intelligent phone format auto-detection, two-way state/province resolution,
 * and per-site override support.
 */

(function (root) {
  // Comprehensive US States, DC, Territories & Canadian Provinces
  const US_AND_CAN_STATES = {
    // US States
    alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
    colorado: 'CO', connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA',
    hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
    kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD',
    massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS',
    missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
    'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC',
    'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA',
    'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN',
    texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
    'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
    // Territories & DC
    'district of columbia': 'DC', 'puerto rico': 'PR', guam: 'GU',
    'virgin islands': 'VI', 'american samoa': 'AS', 'northern mariana islands': 'MP',
    // Canadian Provinces
    alberta: 'AB', 'british columbia': 'BC', manitoba: 'MB', 'new brunswick': 'NB',
    'newfoundland and labrador': 'NL', 'northwest territories': 'NT', 'nova scotia': 'NS',
    nunavut: 'NU', ontario: 'ON', 'prince edward island': 'PE', quebec: 'QC',
    saskatchewan: 'SK', yukon: 'YT'
  };

  // Build reverse map (Code -> Full Name in Title Case)
  const CODE_TO_NAME = {};
  for (const [name, code] of Object.entries(US_AND_CAN_STATES)) {
    const titleCase = name.replace(/\b\w/g, (c) => c.toUpperCase());
    CODE_TO_NAME[code] = titleCase;
  }

  const PATTERNS = [
    // Names
    { key: 'personal.firstName', regex: /\b(first[\s_-]?name|fname|given[\s_-]?name|forename)\b/i, weight: 10 },
    { key: 'personal.lastName', regex: /\b(last[\s_-]?name|lname|surname|family[\s_-]?name)\b/i, weight: 10 },
    { key: 'personal.fullName', regex: /\b(full[\s_-]?name|candidate[\s_-]?name|applicant[\s_-]?name|your[\s_-]?name|^name$)\b/i, weight: 8 },

    // Contact
    { key: 'personal.email', regex: /\b(e[-_]?mail|electronic[\s_-]?mail)\b/i, weight: 10, type: 'email' },
    { key: 'personal.phoneCountryCode', regex: /\b(phone[\s_-]?country|country[\s_-]?dial|dial[\s_-]?code|calling[\s_-]?code|phone[\s_-]?code)\b/i, weight: 12 },
    { key: 'personal.phone', regex: /\b(phone|telephone|mobile|cell|contact[\s_-]?number|tel)\b/i, weight: 10, type: 'tel' },

    // Address
    { key: 'personal.address2', regex: /\b(address[\s_-]?(line[\s_-]?)?2|apt|apartment|suite|unit|bldg|floor)\b/i, weight: 9 },
    { key: 'personal.address1', regex: /\b(address[\s_-]?(line[\s_-]?)?1|street[\s_-]?address|^address$|residence)\b/i, weight: 8 },
    { key: 'personal.city', regex: /\b(city|town|municipality|suburb)\b/i, weight: 9 },
    { key: 'personal.state', regex: /\b(state|province|region|territory|administrative[\s_-]?area)\b/i, weight: 9 },
    { key: 'personal.postalCode', regex: /\b(zip[\s_-]?code|postal[\s_-]?code|postcode|^zip$)\b/i, weight: 9 },
    { key: 'personal.country', regex: /\b(country|nation|country[\s_-]?region)\b/i, weight: 9 },

    // Links & Profiles
    { key: 'links.linkedin', regex: /\b(linkedin|linked[\s_-]?in)\b/i, weight: 10 },
    { key: 'links.github', regex: /\b(github|git[\s_-]?hub|code[\s_-]?repo)\b/i, weight: 10 },
    { key: 'links.portfolio', regex: /\b(portfolio|personal[\s_-]?website|project[\s_-]?url|showcase)\b/i, weight: 9 },
    { key: 'links.twitter', regex: /\b(twitter|x\.com|twitter[\s_-]?handle)\b/i, weight: 8 },
    { key: 'links.website', regex: /\b(website|blog|personal[\s_-]?url|webpage)\b/i, weight: 7 },

    // Education
    { key: 'education.school', regex: /\b(university|college|school|institution|alma[\s_-]?mater)\b/i, weight: 9 },
    { key: 'education.degree', regex: /\b(degree|qualification|highest[\s_-]?degree|education[\s_-]?level)\b/i, weight: 8 },
    { key: 'education.major', regex: /\b(major|field[\s_-]?of[\s_-]?study|discipline|course[\s_-]?of[\s_-]?study|subject)\b/i, weight: 8 },
    { key: 'education.gpa', regex: /\b(gpa|grade[\s_-]?point[\s_-]?average)\b/i, weight: 10 },
    { key: 'education.gradYear', regex: /\b(grad(uation)?[\s_-]?year|year[\s_-]?of[\s_-]?graduation|end[\s_-]?year)\b/i, weight: 9 },

    // Work Experience
    { key: 'work.currentTitle', regex: /\b(current[\s_-]?(job[\s_-]?)?title|job[\s_-]?title|current[\s_-]?role|headline)\b/i, weight: 9 },
    { key: 'work.currentCompany', regex: /\b(current[\s_-]?company|current[\s_-]?employer|company[\s_-]?name|organization)\b/i, weight: 8 },
    { key: 'work.yearsExperience', regex: /\b(years[\s_-]?(of[\s_-]?)?experience|total[\s_-]?experience|experience[\s_-]?years)\b/i, weight: 9 },
    { key: 'work.noticePeriod', regex: /\b(notice[\s_-]?period|availability|available[\s_-]?to[\s_-]?start|earliest[\s_-]?start)\b/i, weight: 8 },
    { key: 'work.expectedSalary', regex: /\b(desired[\s_-]?salary|expected[\s_-]?salary|compensation[\s_-]?expectation|target[\s_-]?salary)\b/i, weight: 9 },
    { key: 'work.currentSalary', regex: /\b(current[\s_-]?salary|current[\s_-]?compensation)\b/i, weight: 9 },
    { key: 'work.summary', regex: /\b(professional[\s_-]?summary|candidate[\s_-]?summary|about[\s_-]?yourself|cover[\s_-]?letter|bio)\b/i, weight: 7 },

    // Work Authorization & Compliance
    { key: 'authorization.authorizedUS', regex: /\b(legally[\s_-]?authorized|authorized[\s_-]?to[\s_-]?work|work[\s_-]?authorization|eligible[\s_-]?to[\s_-]?work)\b/i, weight: 10 },
    { key: 'authorization.requireSponsorship', regex: /\b(require[\s_-]?sponsorship|need[\s_-]?sponsorship|sponsorship[\s_-]?now[\s_-]?or[\s_-]?in[\s_-]?the[\s_-]?future|visa[\s_-]?sponsorship)\b/i, weight: 10 },
    { key: 'authorization.veteranStatus', regex: /\b(veteran[\s_-]?status|military[\s_-]?service|protected[\s_-]?veteran)\b/i, weight: 8 },
    { key: 'authorization.disabilityStatus', regex: /\b(disability[\s_-]?status|have[\s_-]?a[\s_-]?disability|voluntary[\s_-]?self[\s_-]?identification.*disability)\b/i, weight: 8 },
    { key: 'authorization.gender', regex: /\b(gender|gender[\s_-]?identity|sex)\b/i, weight: 8 },
    { key: 'authorization.race', regex: /\b(race|ethnicity|ethnic[\s_-]?background)\b/i, weight: 8 },

    // Common Q&A
    { key: 'qa.tellMeAboutYourself', regex: /\b(tell[\s_-]?me[\s_-]?about[\s_-]?yourself|background|summary[\s_-]?of[\s_-]?qualifications)\b/i, weight: 8 },
    { key: 'qa.whyThisCompany', regex: /\b(why[\s_-]?(do[\s_-]?you[\s_-]?want[\s_-]?to[\s_-]?work[\s_-]?(at|for)|this[\s_-]?company|join[\s_-]?us))\b/i, weight: 9 },
    { key: 'qa.greatestStrength', regex: /\b(greatest[\s_-]?strength|key[\s_-]?skills|core[\s_-]?competencies)\b/i, weight: 8 }
  ];

  const AppFillerMatcher = {
    /**
     * Inspects a DOM element and returns clean text hints from labels, placeholders, aria, id, and name.
     */
    getFieldClues(element) {
      const clues = [];

      // Identifier attributes are usually camelCase or kebab-case ("addressLine1",
      // "phone-device-type"). Push a space-separated form too so the word-boundary
      // regexes in PATTERNS can actually see the individual words.
      const pushIdentifier = (raw) => {
        if (!raw) return;
        clues.push(raw);
        const spaced = String(raw)
          .replace(/([a-z])([A-Z])/g, '$1 $2')
          .replace(/([A-Za-z])(\d)/g, '$1 $2')
          .replace(/[_\-.]+/g, ' ');
        if (spaced !== raw) clues.push(spaced);
      };

      // 1. Explicit attributes
      pushIdentifier(element.name);
      pushIdentifier(element.id);
      if (element.placeholder) clues.push(element.placeholder);
      if (element.getAttribute('aria-label')) clues.push(element.getAttribute('aria-label'));
      if (element.getAttribute('autocomplete')) clues.push(element.getAttribute('autocomplete'));
      pushIdentifier(element.getAttribute('data-qa'));
      pushIdentifier(element.getAttribute('data-test'));
      if (element.getAttribute('title')) clues.push(element.getAttribute('title'));

      // 1b. Workday & friends identify every control by data-automation-id
      // ("addressLine1", "countryRegion", "phone-device-type"). The visible label
      // is often not associated with the input at all, so this is frequently the
      // only reliable clue on those forms.
      pushIdentifier(element.getAttribute('data-automation-id'));
      pushIdentifier(element.getAttribute('data-automation-label'));
      pushIdentifier(element.getAttribute('data-uxi-element-id'));
      const automationWrapper = element.parentElement
        ? element.parentElement.closest('[data-automation-id]')
        : null;
      if (automationWrapper) {
        pushIdentifier(automationWrapper.getAttribute('data-automation-id'));
      }

      // 2. Associated <label for="id">
      if (element.id) {
        try {
          const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
          if (label && label.innerText) {
            clues.push(label.innerText.trim());
          }
        } catch (e) {
          // ignore CSS escape errors
        }
      }

      // 3. Enclosing <label>
      const parentLabel = element.closest('label');
      if (parentLabel && parentLabel.innerText) {
        clues.push(parentLabel.innerText.trim());
      }

      // 4. aria-labelledby
      const labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        const ids = labelledBy.split(/\s+/);
        ids.forEach((id) => {
          const el = document.getElementById(id);
          if (el && el.innerText) clues.push(el.innerText.trim());
        });
      }

      // 5. Surrounding parent label/heading (common in Greenhouse, Lever, Ashby, Workday)
      const formGroup = element.closest('.field, .form-group, [class*="form-group"], [class*="field-"], [class*="question"], div[data-automation-id]');
      if (formGroup) {
        const groupLabel = formGroup.querySelector('label, .label, [class*="label"], legend, h3, h4, span[class*="label"]');
        if (groupLabel && groupLabel !== parentLabel && groupLabel.innerText) {
          clues.push(groupLabel.innerText.trim());
        }
      }

      // 6. Preceding sibling text or label
      let prev = element.previousElementSibling;
      let count = 0;
      while (prev && count < 2) {
        if (prev.matches('label, span, div, p') && prev.innerText && prev.innerText.length < 100) {
          clues.push(prev.innerText.trim());
          break;
        }
        prev = prev.previousElementSibling;
        count++;
      }

      return clues.join(' ').toLowerCase();
    },

    /**
     * Resolves state/province into full name, 2-letter code, and matching variants.
     */
    resolveState(stateInput) {
      if (!stateInput) return { name: '', code: '', variants: [] };
      const raw = String(stateInput).trim();
      const lower = raw.toLowerCase();

      let code = '';
      let name = '';

      if (US_AND_CAN_STATES[lower]) {
        code = US_AND_CAN_STATES[lower];
        name = raw.replace(/\b\w/g, (c) => c.toUpperCase());
      } else if (CODE_TO_NAME[raw.toUpperCase()]) {
        code = raw.toUpperCase();
        name = CODE_TO_NAME[code];
      } else {
        name = raw;
        code = raw.length === 2 ? raw.toUpperCase() : '';
      }

      const variants = [name, code, `US-${code}`, `${code} - ${name}`, `${name} (${code})`].filter(Boolean);
      return { name, code, variants };
    },

    /**
     * Deconstructs a phone number string into all standard formats.
     */
    parsePhoneNumber(phoneInput) {
      if (!phoneInput) {
        return {
          digits: '',
          national: '',
          dashed: '',
          dotted: '',
          international: '',
          internationalDigits: '',
          countryCode: '1'
        };
      }

      const raw = String(phoneInput).trim();
      // Extract pure digits
      let digitsOnly = raw.replace(/\D/g, '');
      let countryCode = '1';

      // Check if starts with 1 and is 11 digits (e.g. +1 555 349 2810)
      if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
        countryCode = '1';
        digitsOnly = digitsOnly.slice(1);
      } else if (raw.startsWith('+')) {
        // Non-US country code
        const match = raw.match(/^\+(\d{1,3})/);
        if (match) {
          countryCode = match[1];
          if (digitsOnly.startsWith(countryCode)) {
            digitsOnly = digitsOnly.slice(countryCode.length);
          }
        }
      }

      // If we have 10 digits (standard North America)
      if (digitsOnly.length === 10) {
        const area = digitsOnly.slice(0, 3);
        const mid = digitsOnly.slice(3, 6);
        const end = digitsOnly.slice(6, 10);

        return {
          digits: digitsOnly, // 5553492810 (10 chars)
          national: `(${area}) ${mid}-${end}`, // (555) 349-2810 (14 chars)
          dashed: `${area}-${mid}-${end}`, // 555-349-2810 (12 chars)
          dotted: `${area}.${mid}.${end}`, // 555.349.2810 (12 chars)
          international: `+${countryCode} (${area}) ${mid}-${end}`, // +1 (555) 349-2810
          internationalDashed: `+${countryCode}-${area}-${mid}-${end}`,
          internationalDigits: `+${countryCode}${digitsOnly}`,
          countryCode: `+${countryCode}`
        };
      }

      // Fallback for non-standard length
      return {
        digits: digitsOnly,
        national: raw,
        dashed: raw,
        dotted: raw,
        international: raw.startsWith('+') ? raw : `+1 ${raw}`,
        internationalDigits: `+1${digitsOnly}`,
        countryCode: `+${countryCode}`
      };
    },

    /**
     * Intelligently selects the best phone format for a specific input element,
     * taking into account site rules, user preferences, maxlength, pattern, and nearby fields.
     */
    adaptPhoneNumber(element, phoneData, siteRule = null, userPreference = 'adaptive') {
      // 1. Site Rule Override
      if (siteRule && siteRule.phoneFormat && siteRule.phoneFormat !== 'adaptive') {
        const format = siteRule.phoneFormat;
        if (format === 'digits') return phoneData.digits;
        if (format === 'national') return phoneData.national;
        if (format === 'dashed') return phoneData.dashed;
        if (format === 'international') return phoneData.international;
      }

      // 2. User Profile Preference Override (if not adaptive)
      if (userPreference && userPreference !== 'adaptive') {
        if (userPreference === 'digits') return phoneData.digits;
        if (userPreference === 'national') return phoneData.national;
        if (userPreference === 'dashed') return phoneData.dashed;
        if (userPreference === 'international') return phoneData.international;
      }

      // 3. Adaptive Auto-Detection based on field attributes
      const maxLen = element.maxLength;
      const pattern = element.getAttribute('pattern') || '';
      const placeholder = (element.placeholder || '').toLowerCase();
      const inputType = (element.type || '').toLowerCase();
      const inputMode = (element.getAttribute('inputmode') || '').toLowerCase();

      // Detect if there's a separate country code selector right next to or before this input
      const hasSeparateCountryCode = this.hasSeparateCountryCodeInput(element);

      // Rule A: Separate Country Code exists -> NEVER include +1 in this input!
      if (hasSeparateCountryCode) {
        if (maxLen === 10 || maxLen === 11) return phoneData.digits;
        if (placeholder.includes('xxx-xxx-xxxx') || placeholder.includes('555-')) return phoneData.dashed;
        if (placeholder.includes('(') || placeholder.includes(')')) return phoneData.national;
        return phoneData.digits || phoneData.dashed;
      }

      // Rule B: maxlength constraints
      if (maxLen > 0) {
        if (maxLen === 10) return phoneData.digits; // Exactly 10 digits
        if (maxLen === 12) return phoneData.dashed; // 555-555-5555
        if (maxLen === 14) return phoneData.national; // (555) 555-5555
        if (maxLen <= 11) return phoneData.digits;
        if (maxLen < 16) return phoneData.dashed; // Not enough room for international
      }

      // Rule C: Pattern constraints
      if (pattern) {
        if (/\\d\{10\}|\[0-9\]\{10\}/.test(pattern)) return phoneData.digits;
        if (/\\d\{3\}[-.]?\\d\{3\}[-.]?\\d\{4\}/.test(pattern)) return phoneData.dashed;
      }

      // Rule D: Placeholder clues
      if (placeholder) {
        if (placeholder.includes('+') || placeholder.includes('international') || placeholder.includes('country code')) {
          return phoneData.international;
        }
        if (/^\d{10}$|10[\s_-]?digit/.test(placeholder)) {
          return phoneData.digits;
        }
        if (placeholder.includes('(') && placeholder.includes(')')) {
          return phoneData.national;
        }
        if (placeholder.includes('-')) {
          return phoneData.dashed;
        }
      }

      // Rule E: Pure numeric mode without mask
      if (inputMode === 'numeric' || inputType === 'number') {
        return phoneData.digits;
      }

      // Safe Default for North America: Standard national format without +1, or dashed.
      // Crucial: Domestic job applications reject "+1" 95% of the time if not asked!
      return phoneData.dashed || phoneData.digits;
    },

    /**
     * Checks if there is a separate country code selector nearby
     */
    hasSeparateCountryCodeInput(element) {
      // Check previous siblings
      let prev = element.previousElementSibling;
      while (prev) {
        const name = (prev.name || prev.id || prev.className || '').toLowerCase();
        if (/country[\s_-]?code|dial[\s_-]?code|phone[\s_-]?code|phone[\s_-]?country/.test(name)) {
          return true;
        }
        prev = prev.previousElementSibling;
      }

      // Check within parent container
      const container = element.closest('.form-group, .field, [class*="phone"]');
      if (container) {
        const countrySelect = container.querySelector('select, [class*="country"], [class*="dial"]');
        if (countrySelect && countrySelect !== element) {
          return true;
        }
      }

      return false;
    },

    /**
     * Resolves dot-notation string property from an object (e.g. 'personal.firstName')
     */
    getNestedValue(obj, path) {
      if (!obj || !path) return null;
      const parts = path.split('.');
      let curr = obj;
      for (const part of parts) {
        if (curr == null) return null;
        curr = curr[part];
      }
      return curr != null ? String(curr) : null;
    },

    /**
     * Attempts to match a field element against the profile data.
     * Returns { matchedKey, value, confidence, fieldType } or null.
     */
    matchField(element, profile, siteRule = null, userPreferences = {}) {
      if (!element || !profile) return null;

      const type = (element.type || '').toLowerCase();
      const isComboboxTrigger = element.tagName.toLowerCase() === 'button' &&
        (element.getAttribute('aria-haspopup') === 'listbox' || element.getAttribute('role') === 'combobox');
      if (!isComboboxTrigger && ['submit', 'button', 'hidden', 'file', 'reset', 'image'].includes(type)) {
        return null;
      }

      if (element.disabled || element.readOnly) {
        return null;
      }

      const clues = this.getFieldClues(element);
      if (!clues) return null;

      // 1. Check custom fields defined by user first
      if (profile.customFields && Array.isArray(profile.customFields)) {
        for (const custom of profile.customFields) {
          if (!custom.key || !custom.value) continue;
          const cleanKey = custom.key.trim().toLowerCase();
          if (clues.includes(cleanKey)) {
            return {
              matchedKey: `custom.${custom.key}`,
              value: custom.value,
              confidence: 15
            };
          }
        }
      }

      // 2. Separate Country Code Field
      if (PATTERNS.find((p) => p.key === 'personal.phoneCountryCode').regex.test(clues)) {
        return {
          matchedKey: 'personal.phoneCountryCode',
          value: '+1',
          confidence: 12,
          fieldType: 'phoneCountryCode'
        };
      }

      // 3/4. Country vs. State disambiguation.
      // These two overlap on the word "region": Workday labels its country field
      // "Country/Region", while naming its *state* field's automation id
      // "countryRegion". Resolve in three steps rather than letting one pattern
      // win by position:
      //   a) words that only ever appear on a state field  -> state
      //   b) otherwise a country word                      -> country
      //   c) a bare "region" with no country word          -> state
      const statePattern = PATTERNS.find((p) => p.key === 'personal.state');
      const countryPattern = PATTERNS.find((p) => p.key === 'personal.country');
      // "countryregion" with no separator is Workday's state/province automation id;
      // the visible label "Country/Region" keeps its slash and so never matches this.
      const definitelyState = /\b(state|province|territory|administrative[\s_-]?area)\b|countryregion/i.test(clues);

      const buildStateMatch = () => {
        const rawState = profile.personal?.state || profile.personal?.stateCode || 'California';
        const stateInfo = this.resolveState(rawState);

        let chosenState = stateInfo.name;

        // Check Site Rule
        if (siteRule && siteRule.stateFormat) {
          if (siteRule.stateFormat === 'code') chosenState = stateInfo.code;
          if (siteRule.stateFormat === 'name') chosenState = stateInfo.name;
        } else if (userPreferences.stateFormat && userPreferences.stateFormat !== 'adaptive') {
          if (userPreferences.stateFormat === 'code') chosenState = stateInfo.code;
          if (userPreferences.stateFormat === 'name') chosenState = stateInfo.name;
        } else {
          // Adaptive: Check input length or clues
          if (element.maxLength === 2 || clues.includes('2 letter') || clues.includes('abbrev') || (element.placeholder && element.placeholder.length <= 3)) {
            chosenState = stateInfo.code;
          }
        }

        return {
          matchedKey: 'personal.state',
          value: chosenState,
          stateInfo,
          confidence: 10,
          fieldType: 'state'
        };
      };

      if (definitelyState) {
        return buildStateMatch();
      }

      if (countryPattern.regex.test(clues)) {
        return {
          matchedKey: 'personal.country',
          value: profile.personal?.country || 'United States',
          confidence: 12,
          fieldType: 'country'
        };
      }

      if (statePattern.regex.test(clues)) {
        return buildStateMatch();
      }

      // 5. Phone Field Special Handling
      const phonePattern = PATTERNS.find((p) => p.key === 'personal.phone');
      const isPhoneClassifierField = /phone[\s_-]?type|phone[\s_-]?device|device[\s_-]?type|number[\s_-]?type|phone[\s_-]?extension|\bext(ension)?\b/i.test(clues);
      if (phonePattern.regex.test(clues) && !isPhoneClassifierField) {
        const rawPhone = profile.personal?.phone || '';
        const phoneData = this.parsePhoneNumber(rawPhone);
        const adaptedPhone = this.adaptPhoneNumber(element, phoneData, siteRule, userPreferences.phoneFormat);

        return {
          matchedKey: 'personal.phone',
          value: adaptedPhone,
          phoneData,
          confidence: 11,
          fieldType: 'phone'
        };
      }

      // 6. Standard Pattern Matching
      let bestMatch = null;
      let highestScore = 0;

      for (const pattern of PATTERNS) {
        if (pattern.key === 'personal.state' || pattern.key === 'personal.phone') continue;

        if (pattern.regex.test(clues)) {
          const val = this.getNestedValue(profile, pattern.key);
          if (val) {
            let score = pattern.weight;
            if (pattern.type && type === pattern.type) {
              score += 5;
            }
            if (score > highestScore) {
              highestScore = score;
              bestMatch = {
                matchedKey: pattern.key,
                value: val,
                confidence: score
              };
            }
          }
        }
      }

      return bestMatch;
    },

    /**
     * Sets value on input/textarea/select and dispatches events so React, Angular, Vue detect change.
     */
    async setElementValue(element, matchData) {
      if (!element || !matchData) return false;

      const tag = element.tagName.toLowerCase();
      const type = (element.type || '').toLowerCase();
      const value = typeof matchData === 'object' && matchData.value !== undefined ? matchData.value : matchData;

      try {
        // Select Dropdowns
        if (tag === 'select') {
          // Special state matching if stateInfo provided
          if (matchData.stateInfo && matchData.stateInfo.variants) {
            return this.setSelectValueState(element, matchData.stateInfo);
          }
          return this.setSelectValue(element, value);
        }

        // Button-triggered custom dropdowns (e.g. Workday's state/country listbox widget)
        if (tag === 'button') {
          if (element.getAttribute('aria-expanded') !== 'true') {
            element.click();
          }
          // Awaited so only one such dropdown is ever open/being resolved at a
          // time — without this, fields processed later in the loop can open
          // their own dropdown before this one resolves, and stray clicks can
          // land in whichever dropdown happens to be open.
          const matched = await this.maybeTriggerComboboxSelection(element, value, matchData.stateInfo || null);
          if (!matched && element.getAttribute('aria-expanded') === 'true') {
            element.click(); // close it — no match, don't leave it hanging open
          }
          return matched;
        }

        // Checkboxes
        if (type === 'checkbox') {
          const shouldCheck = ['true', 'yes', '1', 'checked'].includes(String(value).toLowerCase());
          if (element.checked !== shouldCheck) {
            element.checked = shouldCheck;
            this.dispatchSyntheticEvents(element);
            return true;
          }
          return false;
        }

        // Radio Buttons
        if (type === 'radio') {
          const valStr = String(value).toLowerCase();
          const clues = (element.value + ' ' + this.getFieldClues(element)).toLowerCase();
          if (clues.includes(valStr) || element.value.toLowerCase() === valStr) {
            element.checked = true;
            this.dispatchSyntheticEvents(element);
            return true;
          }
          return false;
        }

        // Standard text, email, tel, url, number, textarea
        const prototype = tag === 'textarea' 
          ? window.HTMLTextAreaElement.prototype 
          : window.HTMLInputElement.prototype;
          
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(element, value);
        } else {
          element.value = value;
        }

        // Detect whether element is a combobox BEFORE dispatching events
        const isComboboxEl = this.isComboboxElement(element);

        if (isComboboxEl) {
          // For combobox inputs, dispatching blur/change causes the dropdown to close
          // before it renders. Only dispatch focus + input to trigger filtering.
          element.dispatchEvent(new Event('focus', { bubbles: true }));
          element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        } else {
          this.dispatchSyntheticEvents(element);
        }

        // Set up async combobox selection (uses MutationObserver — safe to call always)
        await this.maybeTriggerComboboxSelection(element, value, matchData.stateInfo || null);

        return true;
      } catch (err) {
        console.error('AppFiller: Error setting value on', element, err);
        element.value = value;
        this.dispatchSyntheticEvents(element);
        return true;
      }
    },

    /**
     * Enhanced select matcher for States & Provinces (checks name, code, US-XX, etc.)
     */
    setSelectValueState(selectElement, stateInfo) {
      const candidates = stateInfo.variants.map((v) => v.toLowerCase());

      // 1. Exact match on value or text
      for (const target of candidates) {
        for (let i = 0; i < selectElement.options.length; i++) {
          const opt = selectElement.options[i];
          const val = opt.value.trim().toLowerCase();
          const txt = opt.text.trim().toLowerCase();
          if (val === target || txt === target) {
            selectElement.selectedIndex = i;
            this.dispatchSyntheticEvents(selectElement);
            return true;
          }
        }
      }

      // 2. Substring match
      for (const target of candidates) {
        if (target.length < 3) continue; // skip 2-letter codes for broad substring to prevent false positives
        for (let i = 0; i < selectElement.options.length; i++) {
          const opt = selectElement.options[i];
          const val = opt.value.trim().toLowerCase();
          const txt = opt.text.trim().toLowerCase();
          if (txt.includes(target) || val.includes(target)) {
            selectElement.selectedIndex = i;
            this.dispatchSyntheticEvents(selectElement);
            return true;
          }
        }
      }

      return false;
    },

    /**
     * Smart select matcher: matches option by text or value
     */
    setSelectValue(selectElement, targetValue) {
      const target = String(targetValue).trim().toLowerCase();
      let matchedIndex = -1;

      // 1. Exact match on value or text
      for (let i = 0; i < selectElement.options.length; i++) {
        const opt = selectElement.options[i];
        const val = opt.value.trim().toLowerCase();
        const txt = opt.text.trim().toLowerCase();
        if (val === target || txt === target) {
          matchedIndex = i;
          break;
        }
      }

      // 2. Substring match if no exact match found
      if (matchedIndex === -1) {
        for (let i = 0; i < selectElement.options.length; i++) {
          const opt = selectElement.options[i];
          const val = opt.value.trim().toLowerCase();
          const txt = opt.text.trim().toLowerCase();
          if ((txt && txt.includes(target)) || (target && target.includes(txt) && txt.length > 2)) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 3. Country code match (e.g. "+1" or "United States" or "US")
      if (matchedIndex === -1 && (target === '+1' || target === '1' || target.includes('united states'))) {
        for (let i = 0; i < selectElement.options.length; i++) {
          const opt = selectElement.options[i];
          const txt = opt.text.trim().toLowerCase();
          const val = opt.value.trim().toLowerCase();
          if (val === '+1' || val === '1' || val === 'us' || txt.includes('+1') || txt.includes('united states')) {
            matchedIndex = i;
            break;
          }
        }
      }

      // 4. Boolean/Authorization mapping (Yes/No vs 1/0 vs True/False)
      if (matchedIndex === -1) {
        const isYes = ['yes', 'true', 'authorized', '1'].includes(target);
        const isNo = ['no', 'false', 'unauthorized', '0'].includes(target);
        for (let i = 0; i < selectElement.options.length; i++) {
          const opt = selectElement.options[i];
          const txt = opt.text.trim().toLowerCase();
          const val = opt.value.trim().toLowerCase();
          if (isYes && (txt === 'yes' || val === 'yes' || txt === 'true' || val === '1')) {
            matchedIndex = i;
            break;
          }
          if (isNo && (txt === 'no' || val === 'no' || txt === 'false' || val === '0')) {
            matchedIndex = i;
            break;
          }
        }
      }

      if (matchedIndex >= 0) {
        selectElement.selectedIndex = matchedIndex;
        this.dispatchSyntheticEvents(selectElement);
        return true;
      }

      return false;
    },

    /**
     * Handles modern searchable combobox dropdowns (e.g. React-Select, Workday autocomplete).
     * Uses MutationObserver to wait for the listbox to actually render (async AJAX/React),
     * then finds and clicks the option whose text matches value or stateInfo variants.
     * @param {HTMLElement} element - The combobox input element
     * @param {string} value - The value to search for
     * @param {object|null} stateInfo - Optional stateInfo with .variants array for state matching
     */
    maybeTriggerComboboxSelection(element, value, stateInfo = null) {
      if (!this.isComboboxElement(element)) return Promise.resolve(false);

      // Build ordered list of text candidates to match against option labels
      const rawCandidates = stateInfo && stateInfo.variants
        ? [...stateInfo.variants]
        : [String(value)];
      const candidates = rawCandidates.map((c) => c.trim().toLowerCase()).filter(Boolean);

      /**
       * Searches all visible listboxes for a matching option and clicks it.
       * Returns true if a match was found and clicked.
       */
      const findAndClickOption = () => {
        // Broad selector that covers React-Select, Workday, Headless-UI, etc.
        const listboxes = Array.from(document.querySelectorAll(
          '[role="listbox"], .select__menu, [data-automation-id="promptOption"], ' +
          '[class*="dropdown-option"], [class*="options-container"], [class*="suggestions"]'
        ));

        for (const listbox of listboxes) {
          const options = Array.from(listbox.querySelectorAll(
            '[role="option"], .select__option, [data-automation-id="prompt-option"], ' +
            'li[class*="option"], [class*="list-item"], li'
          ));
          if (options.length === 0) continue;

          // 1. Exact text match (highest confidence)
          for (const candidate of candidates) {
            for (const opt of options) {
              if (opt.textContent.trim().toLowerCase() === candidate) {
                opt.click();
                return true;
              }
            }
          }

          // 2. Substring / starts-with match.
          // Short candidates (state codes like "CA") are deliberately excluded here:
          // prefix-matching "ca" against a country list picks "Cabo Verde". Codes
          // that short only ever match via the exact pass above.
          for (const candidate of candidates) {
            if (candidate.length < 4) continue;
            for (const opt of options) {
              const txt = opt.textContent.trim().toLowerCase();
              if (txt.startsWith(candidate) || txt.includes(candidate)) {
                opt.click();
                return true;
              }
            }
          }
        }
        return false;
      };

      return new Promise((resolve) => {
        // Try immediately in case dropdown is already open
        if (findAndClickOption()) {
          resolve(true);
          return;
        }

        // Set up MutationObserver to react the moment the listbox appears in the DOM
        let resolved = false;
        const observer = new MutationObserver(() => {
          if (resolved) return;
          if (findAndClickOption()) {
            resolved = true;
            observer.disconnect();
            resolve(true);
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // Safety timeout — give Workday/React up to 4 seconds to render options
        setTimeout(() => {
          if (!resolved) {
            observer.disconnect();
            const success = findAndClickOption(); // last-chance attempt
            resolve(success);
          }
        }, 4000);
      });
    },

    /**
     * Returns true if element appears to be a custom combobox (not a native select).
     */
    isComboboxElement(element) {
      const role = (element.getAttribute('role') || '').toLowerCase();
      const ariaAuto = element.getAttribute('aria-autocomplete') || '';
      const ariaPopup = element.getAttribute('aria-haspopup') || '';
      const cls = (typeof element.className === 'string' ? element.className : '');
      const dataId = (element.getAttribute('data-automation-id') || '').toLowerCase();
      return (
        role === 'combobox' ||
        ariaAuto !== '' ||
        ariaPopup === 'listbox' ||
        cls.includes('select__input') ||
        dataId.includes('combobox') ||
        !!element.closest('[class*="autocomplete"], [class*="combobox"], [data-automation-id*="combobox"]')
      );
    },

    /**
     * Dispatches comprehensive synthetic DOM events for framework binding
     */
    dispatchSyntheticEvents(element) {
      element.dispatchEvent(new Event('focus', { bubbles: true }));
      element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      element.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  };

  root.AppFillerMatcher = AppFillerMatcher;
})(typeof globalThis !== 'undefined' ? globalThis : this);

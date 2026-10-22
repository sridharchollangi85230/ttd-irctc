(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const visible = element => {
    if (!element) return false;
    if (element.disabled || element.hidden) return false;

    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none") return false;

    try {
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
    } catch {
      return false;
    }

    return true;
  };

  const fields = root => {
    const selector = [
      "input:not([type='hidden'])",
      "textarea",
      "select",
      "[role='combobox']",
      "[role='textbox']",
      "[contenteditable='true']",
      "[aria-haspopup='listbox']",
      "[aria-expanded]",
      "mat-select",
      ".mat-select",
      ".mat-mdc-select",
      ".custom-select",
      ".select-box"
    ].join(", ");

    return [...(root || document).querySelectorAll(selector)]
      .filter(visible)
      .filter(el => !el.closest("[aria-hidden='true'], [hidden], .hidden, .ng-hide"));
  };

  const textFor = element => {
    if (!element) return "";
    const values = [];

    if (element.labels) {
      [...element.labels].forEach(label => {
        const text = label.innerText || label.textContent || "";
        if (text) values.push(text);
      });
    }

    const attrs = [
      "aria-label", "aria-labelledby", "placeholder", "name", "id",
      "formcontrolname", "data-testid", "data-label", "title"
    ];
    attrs.forEach(attr => {
      const value = element.getAttribute(attr);
      if (value) values.push(value);
    });

    const nearby = element.closest("label, div, td, li, tr, section, article, form");
    if (nearby && nearby.innerText) values.push(nearby.innerText.slice(0, 400));

    const parent = element.parentElement;
    if (parent && parent.innerText) values.push(parent.innerText.slice(0, 400));

    const prev = element.previousElementSibling;
    if (prev && prev.innerText) values.push(prev.innerText.slice(0, 200));

    const next = element.nextElementSibling;
    if (next && next.innerText) values.push(next.innerText.slice(0, 200));

    return normalize(values.join(" "));
  };

  const nativeSetter = (element, value) => {
    const stringValue = String(value);

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(element), "value"
      );
      if (descriptor && descriptor.set) {
        descriptor.set.call(element, stringValue);
        return;
      }
    }

    if (element instanceof HTMLSelectElement) {
      element.value = stringValue;
      return;
    }

    element.value = stringValue;
  };

  const setValue = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const normalized = String(value).trim();
    if (!normalized) return false;

    nativeSetter(element, normalized);

    ["input", "change", "blur"].forEach(type => {
      try {
        element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
      } catch {}
    });

    return true;
  };

  const optionMatches = (element, value) => {
    const wanted = normalize(value);
    if (!element) return false;

    const text = normalize(element.textContent || element.innerText || "");
    const optionValue = normalize(element.getAttribute("value") || "");
    const title = normalize(element.getAttribute("title") || "");

    return (
      text === wanted ||
      optionValue === wanted ||
      title === wanted ||
      text.includes(wanted) ||
      optionValue.includes(wanted) ||
      title.includes(wanted)
    );
  };

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  const setNativeSelect = (element, value) => {
    const option = [...(element.options || [])].find(item => optionMatches(item, value));
    if (!option) return false;

    element.value = option.value;
    ["input", "change", "blur"].forEach(type => {
      try {
        element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
      } catch {}
    });

    return true;
  };

  const overlayCandidates = () => {
    const roots = [...document.querySelectorAll(
      "[role='listbox'], [role='menu'], mat-option, .mat-option, .mat-mdc-option, " +
      ".cdk-overlay-pane, .cdk-overlay-container, .dropdown-menu, [class*='dropdown'], " +
      ".custom-dropdown, .select-menu"
    )].filter(visible);

    const candidates = roots.flatMap(root => [
      ...root.querySelectorAll(
        "[role='option'], [role='menuitem'], mat-option, li, button, option, " +
        ".mat-option, .mat-mdc-option, .mdc-list-item, div, span"
      )
    ]);

    return [...new Set(candidates)]
      .filter(visible)
      .filter(el => {
        const children = [...(el.children || [])];
        const text = normalize(el.textContent || "");
        return !children.some(child => normalize(child.textContent || "") === text);
      });
  };

  const setCustomSelect = async (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") {
      return setNativeSelect(element, value);
    }

    try {
      element.focus?.();
      element.click();
    } catch {}

    let option = null;
    for (let attempt = 0; attempt < 40 && !option; attempt++) {
      option = overlayCandidates().find(item => optionMatches(item, value));
      if (!option) await wait(75);
    }

    if (!option) {
      try {
        element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      } catch {}
      return false;
    }

    try {
      option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
      option.click();
      option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
    } catch {
      try {
        element.click();
      } catch {}
    }

    await wait(150);
    return true;
  };

  const scoreLabel = (label, keywords) => {
    const text = normalize(label || "");
    return keywords.reduce((total, keyword) => {
      const k = normalize(keyword);
      return total + (text.includes(k) ? 1 : 0);
    }, 0);
  };

  const best = (available, keywords, used) => {
    let selected = null;
    let score = -1;

    for (const element of available) {
      if (used.has(element)) continue;

      const label = textFor(element);
      const current = scoreLabel(label, keywords);

      if (current > score) {
        selected = element;
        score = current;
      }
    }

    if (selected) used.add(selected);
    return selected;
  };

  const directFieldMatch = (available, keywords) => {
    const matches = [];
    for (const element of available) {
      const label = textFor(element);
      const score = scoreLabel(label, keywords);
      if (score > 0) matches.push({ element, score });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches[0]?.element || null;
  };

  const fillGeneralDetails = async (root, profile) => {
    if (!profile?.generalDetails) return 0;

    const available = fields(root);
    const used = new Set();
    let count = 0;

    const email = directFieldMatch(available, ["email id", "email", "email address", "e mail"]) ||
      best(available, ["email id", "email", "email address", "e mail"], used);

    const city = directFieldMatch(available, ["city", "town", "place"]) ||
      best(available, ["city", "town", "place"], used);

    const state = directFieldMatch(available, ["state", "province"]) ||
      best(available, ["state", "province"], used);

    const country = directFieldMatch(available, ["country", "nation"]) ||
      best(available, ["country", "nation"], used);

    const pincode = directFieldMatch(available, ["pincode", "pin code", "postal code", "zip code"]) ||
      best(available, ["pincode", "pin code", "postal code", "zip code"], used);

    if (email && setValue(email, profile.generalDetails.email)) count++;
    if (city && setValue(city, profile.generalDetails.city)) count++;
    if (state && setValue(state, profile.generalDetails.state)) count++;
    if (country && setValue(country, profile.generalDetails.country)) count++;
    if (pincode && setValue(pincode, profile.generalDetails.pincode)) count++;

    return count;
  };

  const fillPilgrim = async (root, pilgrim) => {
    const available = fields(root);
    const used = new Set();
    let count = 0;

    const name = directFieldMatch(available, ["pilgrim name", "devotee name", "full name", "name"]) ||
      best(available, ["pilgrim name", "devotee name", "full name", "name"], used);

    const age = directFieldMatch(available, ["age", "years"]) ||
      best(available, ["age", "years"], used);

    const gender = directFieldMatch(available, ["gender", "sex"]) ||
      best(available, ["gender", "sex"], used);

    const proof = directFieldMatch(available, ["photo id proof", "id proof", "proof type", "document type", "identity proof"]) ||
      best(available, ["photo id proof", "id proof", "proof type", "document type", "identity proof"], used);

    const number = directFieldMatch(available, ["photo id number", "id number", "proof id number", "document number", "identity number"]) ||
      best(available, ["photo id number", "id number", "proof id number", "document number", "identity number"], used);

    if (name && setValue(name, pilgrim.name)) count++;
    if (age && setValue(age, pilgrim.age)) count++;
    if (gender && (await setCustomSelect(gender, pilgrim.gender))) count++;
    if (proof && (await setCustomSelect(proof, pilgrim.idType))) count++;
    if (number && setValue(number, pilgrim.idNumber)) count++;

    return count;
  };

  const findGroups = expected => {
    const all = fields(document);

    const pilgrimKeywords = [
      "name", "age", "years", "gender", "sex", "photo id",
      "id proof", "document", "identity"
    ];

    const pilgrimFields = all.filter(field => {
      const label = textFor(field);
      return pilgrimKeywords.some(keyword => label.includes(normalize(keyword)));
    });

    const rows = [];
    const used = new Set();

    for (const field of [...pilgrimFields].sort((a, b) => {
      const aTop = a.getBoundingClientRect().top;
      const bTop = b.getBoundingClientRect().top;
      return aTop - bTop;
    })) {
      if (used.has(field)) continue;
      const top = field.getBoundingClientRect().top;
      let row = rows.find(candidate => Math.abs(candidate.top - top) <= 18);
      if (!row) {
        row = { top, elements: [] };
        rows.push(row);
      }
      row.elements.push(field);
      used.add(field);
    }

    const rowGroups = rows
      .sort((a, b) => a.top - b.top)
      .map(row => row.elements)
      .filter(row => row.length >= 3);

    if (rowGroups.length >= expected) {
      return rowGroups.slice(0, expected).map(elements => ({ querySelectorAll: () => elements }));
    }

    const candidates = [...document.querySelectorAll(
      "fieldset, section, article, li, tr, .row, [class*='pilgrim'], [class*='passenger'], [class*='devotee']"
    )].filter(visible).filter(group => fields(group).length >= 3);

    const unique = [];
    for (const group of candidates) {
      if (!unique.some(existing => existing.contains(group) || group.contains(existing))) {
        unique.push(group);
      }
      if (unique.length >= expected) break;
    }

    if (unique.length >= expected) {
      return unique.slice(0, expected);
    }

    const chunkSize = Math.max(1, Math.floor(all.length / expected));
    return Array.from({ length: expected }, (_, index) => {
      const selected = all.slice(index * chunkSize, index === expected - 1 ? all.length : (index + 1) * chunkSize);
      return { querySelectorAll: () => selected };
    });
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "fill") return;

    (async () => {
      try {
        const profile = message.profile || { generalDetails: {}, pilgrims: [] };
        const pilgrims = Array.isArray(profile.pilgrims) ? profile.pilgrims : [];
        const groups = findGroups(pilgrims.length || 1);
        let filled = 0;

        if (profile.generalDetails) {
          filled += await fillGeneralDetails(document, profile);
        }

        for (const [index, pilgrim] of pilgrims.entries()) {
          filled += await fillPilgrim(groups[index] || document, pilgrim);
        }

        sendResponse({
          message: filled
            ? `Filled ${filled} field(s) for ${pilgrims.length} pilgrim(s). Review all details before continuing.`
            : "No matching fields found. Check the page and form labels."
        });
      } catch (error) {
        console.error("TTD Smart Autofill:", error);
        sendResponse({ message: "Could not fill this page. Please review manually." });
      }
    })();

    return true;
  });
})();
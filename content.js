(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };
  const fields = root => [...(root || document).querySelectorAll("input, select, textarea, [role='combobox'], [aria-haspopup='listbox'], mat-select")].filter(visible);
  const textFor = element => {
    const values = [];
    if (element.labels) [...element.labels].forEach(label => values.push(label.innerText));
    ["aria-label", "aria-labelledby", "placeholder", "name", "id", "formcontrolname"].forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (value) values.push(value);
    });
    const parent = element.closest("div, td, li, tr, section");
    if (parent?.innerText) values.push(parent.innerText.slice(0, 240));
    return normalize(values.join(" "));
  };
  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
  const nativeSetter = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : element instanceof HTMLInputElement ? HTMLInputElement.prototype : null;
    const setter = prototype && Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value)); else element.value = String(value);
  };
  const setValue = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    nativeSetter(element, value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };
  const optionMatches = (element, value) => {
    const wanted = normalize(value);
    return normalize(element.textContent) === wanted || normalize(element.getAttribute("value")) === wanted;
  };
  const setNativeSelect = (element, value) => {
    const option = [...element.options].find(item => optionMatches(item, value));
    if (!option) return false;
    element.value = option.value;
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };
  const overlayCandidates = () => {
    const roots = [...document.querySelectorAll("[role='listbox'], [role='menu'], mat-option, .mat-option, .mat-mdc-option, .cdk-overlay-pane, .cdk-overlay-container, .dropdown-menu, [class*='dropdown']")].filter(visible);
    return [...new Set(roots.flatMap(root => [...root.querySelectorAll("[role='option'], [role='menuitem'], mat-option, li, button, option, .mat-option, .mat-mdc-option, .mdc-list-item, div, span")]))].filter(visible).filter(element => ![...element.children].some(child => normalize(child.textContent) === normalize(element.textContent)));
  };
  const setCustomSelect = async (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") return setNativeSelect(element, value);
    element.focus?.(); element.click();
    for (let attempt = 0; attempt < 40; attempt++) {
      const option = overlayCandidates().find(item => optionMatches(item, value));
      if (option) {
        option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true })); option.click(); option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
        await wait(250); return true;
      }
      await wait(75);
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  };
  const fieldScore = (label, keywords) => keywords.reduce((score, keyword) => {
    const labelText = normalize(label), key = normalize(keyword);
    if (!key) return score;
    if (labelText === key) return score + 100;
    if (labelText.includes(key)) return score + 30;
    if (labelText.includes(key.replace(/s$/, ""))) return score + 18;
    return score + (key.length > 4 && labelText.includes(key.slice(0, 5)) ? 8 : 0);
  }, 0);
  const best = (available, keywords, used) => {
    let selected = null, score = -1;
    for (const element of available) {
      if (used.has(element)) continue;
      const current = fieldScore(textFor(element), keywords);
      if (current > score) { selected = element; score = current; }
    }
    if (selected) used.add(selected);
    return selected;
  };
  const findField = async (root, keywords, used) => {
    for (let attempt = 0; attempt < 30; attempt++) {
      const field = best(fields(root), keywords, used);
      if (field) return field;
      await wait(100);
    }
    return null;
  };
  const valueMatches = (element, value) => {
    const expected = normalize(value);
    if (!element || !expected) return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") return normalize(element.options[element.selectedIndex]?.textContent) === expected || normalize(element.value) === expected;
    return normalize(element.value) === expected || normalize(element.textContent) === expected || normalize(element.getAttribute("aria-label")) === expected;
  };
  const fillWithRetry = async (root, keywords, value, used, custom = false) => {
    if (value === undefined || value === null || value === "") return { filled: false, field: null };
    for (let attempt = 0; attempt < 3; attempt++) {
      const field = await findField(root, keywords, used);
      if (!field) return { filled: false, field: null };
      const changed = custom ? await setCustomSelect(field, value) : setValue(field, value);
      await wait(100);
      if (changed && valueMatches(field, value)) return { filled: true, field };
      used.delete(field); await wait(250);
    }
    return { filled: false, field: null };
  };
  const fillEntries = async (root, entries) => {
    const used = new Set(), missing = [];
    let filled = 0;
    for (const [keywords, value, custom, name] of entries) {
      const result = await fillWithRetry(root, keywords, value, used, custom);
      if (result.filled) filled++; else missing.push(name);
    }
    return { filled, expected: entries.length, missing };
  };
  const fillGeneralDetails = async (root, profile) => {
    if (!profile?.generalDetails) return { filled: 0, expected: 0, missing: [] };
    const d = profile.generalDetails;
    return fillEntries(root, [
      [["email id", "email", "email address", "e mail"], d.email, false, "email"],
      [["city", "town", "place"], d.city, false, "city"],
      [["state", "province", "state name"], d.state, true, "state"],
      [["country", "nation", "country name"], d.country, true, "country"],
      [["pincode", "pin code", "postal code", "zip code", "zipcode"], d.pincode, false, "pincode"]
    ].filter(([, value]) => value !== undefined && value !== null && value !== ""));
  };
  const fillPilgrim = async (root, pilgrim) => fillEntries(root, [
    [["pilgrim name", "devotee name", "full name", "name"], pilgrim.name, false, "name"],
    [["age", "years"], pilgrim.age, false, "age"],
    [["gender", "sex", "gender details"], pilgrim.gender, true, "gender"],
    [["photo id proof", "id proof", "proof type", "document type", "identity proof", "photoidproof", "idtype"], pilgrim.idType, true, "photo ID proof"],
    [["photo id number", "id number", "proof id number", "document number", "identity number", "photoidnumber"], pilgrim.idNumber, false, "photo ID number"]
  ].filter(([, value]) => value !== undefined && value !== null && value !== ""));
  const findGroups = expected => {
    const all = fields(document), candidates = [...document.querySelectorAll("fieldset, section, article, li, tr, .row, [class*='pilgrim'], [class*='passenger'], [class*='devotee']")].filter(visible).filter(group => fields(group).length >= 3), unique = [];
    for (const group of candidates) { if (!unique.some(existing => existing.contains(group))) unique.push(group); if (unique.length >= expected) break; }
    if (unique.length >= expected) return unique;
    const chunkSize = Math.max(1, Math.floor(all.length / expected));
    return Array.from({ length: expected }, (_, index) => ({ querySelectorAll: () => all.slice(index * chunkSize, index === expected - 1 ? all.length : (index + 1) * chunkSize) }));
  };
  const continueToNextPage = async () => {
    await wait(500);
    const buttons = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a, [role='button']")].filter(visible);
    const button = buttons.find(element => { const label = normalize(element.innerText || element.value || element.getAttribute("aria-label") || element.textContent); return (label.includes("continue") || label.includes("next") || label.includes("proceed")) && !label.includes("payment") && !label.includes("book") && !label.includes("submit"); });
    if (!button) return false;
    button.click(); return true;
  };
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fill", "fillAndContinue"].includes(message.action)) return;
    (async () => {
      try {
        const profile = message.profile || { generalDetails: {}, pilgrims: [] }, pilgrims = Array.isArray(profile.pilgrims) ? profile.pilgrims : [], groups = findGroups(pilgrims.length || 1);
        let filled = 0, expected = 0, missing = [];
        const general = await fillGeneralDetails(document, profile); filled += general.filled; expected += general.expected; missing.push(...general.missing);
        for (const [index, pilgrim] of pilgrims.entries()) { const result = await fillPilgrim(groups[index] || document, pilgrim); filled += result.filled; expected += result.expected; missing.push(...result.missing.map(name => `Pilgrim ${index + 1}: ${name}`)); }
        const complete = expected > 0 && filled === expected && missing.length === 0;
        if (message.action === "fillAndContinue" && complete) {
          const continued = await continueToNextPage();
          sendResponse({ message: continued ? `All required fields filled (${filled}/${expected}). Continued to the next page.` : `All required fields filled (${filled}/${expected}), but the next-page button was not found.` });
        } else {
          const detail = missing.length ? ` Missing: ${missing.join(", ")}.` : " Review details before continuing.";
          sendResponse({ message: complete ? `All required fields are filled (${filled}/${expected}).${detail}` : `Filled ${filled}/${expected} required fields.${detail} Click Fill Form Only again after the page finishes loading.` });
        }
      } catch (error) { console.error("TTD Smart Autofill:", error); sendResponse({ message: "Could not fill this page. Please review manually." }); }
    })();
    return true;
  });
})();

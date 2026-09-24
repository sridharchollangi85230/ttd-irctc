(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  };

  const fields = root => [...(root || document).querySelectorAll(
    "input, select, textarea, [role='combobox'], [aria-haspopup='listbox'], mat-select"
  )].filter(visible);

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

  const nativeSetter = (element, value) => {
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLInputElement
        ? HTMLInputElement.prototype
        : null;
    const setter = prototype && Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value));
    else element.value = String(value);
  };

  const setValue = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    nativeSetter(element, value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const optionMatches = (element, value) => {
    const wanted = normalize(value);
    const text = normalize(element.textContent);
    const optionValue = normalize(element.getAttribute("value"));
    return text === wanted || optionValue === wanted;
  };

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

  const setNativeSelect = (element, value) => {
    const option = [...element.options].find(item => optionMatches(item, value));
    if (!option) return false;
    element.value = option.value;
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const overlayCandidates = () => {
    const roots = [...document.querySelectorAll(
      "[role='listbox'], [role='menu'], mat-option, .mat-option, .mat-mdc-option, " +
      ".cdk-overlay-pane, .cdk-overlay-container, .dropdown-menu, [class*='dropdown']"
    )].filter(visible);
    const candidates = roots.flatMap(root => [
      ...root.querySelectorAll("[role='option'], [role='menuitem'], mat-option, li, button, option, " +
        ".mat-option, .mat-mdc-option, .mdc-list-item, div, span")
    ]);
    return [...new Set(candidates)].filter(visible).filter(element => {
      return ![...element.children].some(child => normalize(child.textContent) === normalize(element.textContent));
    });
  };

  const setCustomSelect = async (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") {
      return setNativeSelect(element, value);
    }

    element.focus?.();
    element.click();
    let option = null;
    for (let attempt = 0; attempt < 30 && !option; attempt++) {
      option = overlayCandidates().find(item => optionMatches(item, value));
      if (!option) await wait(50);
    }
    if (!option) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    option.click();
    option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
    await wait(150);
    return true;
  };

  const best = (available, keywords, used) => {
    let selected = null;
    let score = 0;
    for (const element of available) {
      if (used.has(element)) continue;
      const label = textFor(element);
      const current = keywords.reduce((total, keyword) => total + (label.includes(normalize(keyword)) ? 1 : 0), 0);
      if (current > score) {
        selected = element;
        score = current;
      }
    }
    if (selected) used.add(selected);
    return selected;
  };

  const fillGeneralDetails = async (root, profile) => {
    if (!profile?.generalDetails) return 0;
    const available = fields(root);
    const used = new Set();
    let count = 0;

    const email = best(available, ["email id", "email", "email address", "e mail"], used);
    const city = best(available, ["city", "town", "place"], used);
    const state = best(available, ["state", "province"], used);
    const country = best(available, ["country", "nation"], used);
    const pincode = best(available, ["pincode", "pin code", "postal code", "zip code"], used);

    if (setValue(email, profile.generalDetails.email)) count++;
    if (setValue(city, profile.generalDetails.city)) count++;
    if (await setCustomSelect(state, profile.generalDetails.state)) count++;
    if (await setCustomSelect(country, profile.generalDetails.country)) count++;
    if (setValue(pincode, profile.generalDetails.pincode)) count++;
    return count;
  };

  const fillPilgrim = async (root, pilgrim) => {
    const available = fields(root);
    const used = new Set();
    let count = 0;
    const name = best(available, ["pilgrim name", "devotee name", "full name", "name"], used);
    const age = best(available, ["age", "years"], used);
    const gender = best(available, ["gender", "sex"], used);
    const proof = best(available, ["photo id proof", "id proof", "proof type", "document type", "identity proof"], used);
    const number = best(available, ["photo id number", "id number", "proof id number", "document number", "identity number"], used);
    if (setValue(name, pilgrim.name)) count++;
    if (setValue(age, pilgrim.age)) count++;
    if (await setCustomSelect(gender, pilgrim.gender)) count++;
    if (await setCustomSelect(proof, pilgrim.idType)) count++;
    if (setValue(number, pilgrim.idNumber)) count++;
    return count;
  };

  const findGroups = expected => {
    const all = fields(document);
    const candidates = [...document.querySelectorAll("fieldset, section, article, li, tr, .row, [class*='pilgrim'], [class*='passenger'], [class*='devotee']")]
      .filter(visible).filter(group => fields(group).length >= 3);
    const unique = [];
    for (const group of candidates) {
      if (!unique.some(existing => existing.contains(group))) unique.push(group);
      if (unique.length >= expected) break;
    }
    if (unique.length >= expected) return unique;
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

        sendResponse({ message: filled ? `Filled ${filled} field(s) for ${pilgrims.length} pilgrim(s). Review all details before continuing.` : "No matching fields found. Check the page and form labels." });
      } catch (error) {
        console.error("TTD Smart Autofill:", error);
        sendResponse({ message: "Could not fill this page. Please review manually." });
      }
    })();
    return true;
  });
})();

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

  const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

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
    const roots = [...document.querySelectorAll(
      "[role='listbox'], [role='menu'], mat-option, .mat-option, .mat-mdc-option, .cdk-overlay-pane, .cdk-overlay-container, .dropdown-menu, [class*='dropdown']"
    )].filter(visible);
    return [...new Set(roots.flatMap(root => [...root.querySelectorAll(
      "[role='option'], [role='menuitem'], mat-option, li, button, option, .mat-option, .mat-mdc-option, .mdc-list-item, div, span"
    )]))].filter(visible).filter(element =>
      ![...element.children].some(child => normalize(child.textContent) === normalize(element.textContent))
    );
  };

  const setCustomSelect = async (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") return setNativeSelect(element, value);

    element.focus?.();
    element.click();
    for (let attempt = 0; attempt < 40; attempt++) {
      const option = overlayCandidates().find(item => optionMatches(item, value));
      if (option) {
        option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
        option.click();
        option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
        await wait(250);
        return true;
      }
      await wait(75);
    }
    element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  };

  const fieldScore = (label, keywords) => {
    let total = 0;
    const normalizedLabel = normalize(label);
    for (const keyword of keywords) {
      const normalizedKeyword = normalize(keyword);
      if (!normalizedKeyword) continue;
      if (normalizedLabel === normalizedKeyword) total += 100;
      else if (normalizedLabel.includes(normalizedKeyword)) total += 30;
      else if (normalizedLabel.includes(normalizedKeyword.replace(/s$/, ""))) total += 18;
      else if (normalizedKeyword.length > 4 && normalizedLabel.includes(normalizedKeyword.slice(0, 5))) total += 8;
    }
    return total;
  };

  const best = (available, keywords, used) => {
    let selected = null;
    let score = -1;
    for (const element of available) {
      if (used.has(element)) continue;
      const label = textFor(element);
      const current = fieldScore(label, keywords);
      if (current > score) {
        selected = element;
        score = current;
      }
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

  const fillWithRetry = async (root, keywords, value, used, custom = false) => {
    if (value === undefined || value === null || value === "") return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const field = await findField(root, keywords, used);
      if (!field) return false;
      const result = custom ? await setCustomSelect(field, value) : setValue(field, value);
      if (result) return true;
      used.delete(field);
      await wait(250);
    }
    return false;
  };

  const fillGeneralDetails = async (root, profile) => {
    if (!profile?.generalDetails) return { filled: 0, expected: 0 };
    const details = profile.generalDetails;
    const used = new Set();
    const entries = [
      [["email id", "email", "email address", "e mail"], details.email, false],
      [["city", "town", "place"], details.city, false],
      [["state", "province", "state name"], details.state, true],
      [["country", "nation", "country name"], details.country, true],
      [["pincode", "pin code", "postal code", "zip code", "zipcode"], details.pincode, false]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    let filled = 0;
    for (const [keywords, value, custom] of entries) {
      if (await fillWithRetry(root, keywords, value, used, custom)) filled++;
    }
    return { filled, expected: entries.length };
  };

  const fillPilgrim = async (root, pilgrim) => {
    const used = new Set();
    const entries = [
      [["pilgrim name", "devotee name", "full name", "name"], pilgrim.name, false],
      [["age", "years"], pilgrim.age, false],
      [["gender", "sex", "gender details"], pilgrim.gender, true],
      [["photo id proof", "id proof", "proof type", "document type", "identity proof", "photoidproof", "idtype"], pilgrim.idType, true],
      [["photo id number", "id number", "proof id number", "document number", "identity number", "photoidnumber"], pilgrim.idNumber, false]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    let filled = 0;
    for (const [keywords, value, custom] of entries) {
      if (await fillWithRetry(root, keywords, value, used, custom)) filled++;
    }
    return { filled, expected: entries.length };
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
    return Array.from({ length: expected }, (_, index) => ({
      querySelectorAll: () => all.slice(index * chunkSize, index === expected - 1 ? all.length : (index + 1) * chunkSize)
    }));
  };

  const continueToNextPage = async () => {
    await wait(500);
    const buttons = [...document.querySelectorAll("button, input[type='button'], input[type='submit'], a, [role='button']")].filter(visible);
    const button = buttons.find(element => {
      const label = normalize(element.innerText || element.value || element.getAttribute("aria-label") || element.textContent);
      return (label.includes("continue") || label.includes("next") || label.includes("proceed")) &&
        !label.includes("payment") && !label.includes("book") && !label.includes("submit");
    });
    if (!button) return false;
    button.click();
    return true;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fill", "fillAndContinue"].includes(message.action)) return;
    (async () => {
      try {
        const profile = message.profile || { generalDetails: {}, pilgrims: [] };
        const pilgrims = Array.isArray(profile.pilgrims) ? profile.pilgrims : [];
        const groups = findGroups(pilgrims.length || 1);
        let filled = 0;
        let expected = 0;

        const general = await fillGeneralDetails(document, profile);
        filled += general.filled;
        expected += general.expected;

        for (const [index, pilgrim] of pilgrims.entries()) {
          const result = await fillPilgrim(groups[index] || document, pilgrim);
          filled += result.filled;
          expected += result.expected;
        }

        const complete = expected > 0 && filled === expected;

        if (message.action === "fillAndContinue" && complete) {
          const continued = await continueToNextPage();
          sendResponse({
            message: continued
              ? `Filled and continued (${filled}/${expected} fields).`
              : `Filled all ${filled} fields, but the next-page button was not found.`
          });
        } else {
          sendResponse({
            message: complete
              ? `Filled all ${filled} field(s). Review details before continuing.`
              : `Filled ${filled}/${expected} field(s). Some fields may still be loading; review them before continuing.`
          });
        }
      } catch (error) {
        console.error("TTD Smart Autofill:", error);
        sendResponse({ message: "Could not fill this page. Please review manually." });
      }
    })();
    return true;
  });
})();

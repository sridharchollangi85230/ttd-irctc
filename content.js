(() => {
  const normalize = value => String(value ?? "")
    .toLowerCase()
    .replace(/\u00a0/g, " ")
    .replace(/[^a-z0-9]/g, "");

  const visible = element => {
    if (!element || element.disabled) return false;
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" &&
      !element.closest("[hidden], [aria-hidden='true']") &&
      (rect.width > 0 || rect.height > 0);
  };

  const fields = root => [...(root || document).querySelectorAll(
    "input:not([type='hidden']), select, textarea, [role='combobox'], " +
    "[aria-haspopup='listbox'], mat-select, [contenteditable='true']"
  )].filter(visible);

  const textFor = element => {
    const values = [];
    if (element.labels) [...element.labels].forEach(label => values.push(label.innerText));
    ["aria-label", "aria-labelledby", "placeholder", "name", "id",
      "formcontrolname", "ng-reflect-name", "data-name"].forEach(attribute => {
      const value = element.getAttribute(attribute);
      if (value) values.push(value);
    });

    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) labelledBy.split(/\s+/).forEach(id => {
      const label = document.getElementById(id);
      if (label?.innerText) values.push(label.innerText);
    });

    // Material form fields normally keep the label and control in this parent.
    const parent = element.closest("mat-form-field, .mat-mdc-form-field, " +
      ".mat-form-field, div, td, li, tr, section, article, fieldset, label");
    if (parent?.innerText) values.push(parent.innerText.slice(0, 300));
    return normalize(values.join(" "));
  };

  const isSelect = element => element instanceof HTMLSelectElement ||
    element.tagName?.toLowerCase() === "select" ||
    element.matches?.("[role='combobox'], [aria-haspopup='listbox'], mat-select");

  const emit = (element, type) => element.dispatchEvent(new Event(type, {
    bubbles: true,
    composed: true
  }));

  const setInputValue = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const stringValue = String(value).trim();
    if (!stringValue || isSelect(element)) return false;

    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, stringValue);
    else element.value = stringValue;

    // Angular/React controlled inputs need the native events, not only a
    // property assignment, otherwise the visible text is not form state.
    emit(element, "input");
    emit(element, "change");
    element.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
    return true;
  };

  const optionMatches = (element, value) => {
    const wanted = normalize(value);
    const label = normalize(element.textContent);
    const optionValue = normalize(element.getAttribute("value"));
    const ariaLabel = normalize(element.getAttribute("aria-label"));
    return label === wanted || optionValue === wanted || ariaLabel === wanted;
  };

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  const setNativeSelect = (element, value) => {
    const option = [...element.options].find(candidate => optionMatches(candidate, value));
    if (!option) return false;
    element.value = option.value;
    emit(element, "input");
    emit(element, "change");
    emit(element, "blur");
    return true;
  };

  const openOptions = () => [...document.querySelectorAll(
    "[role='option'], mat-option, .mat-option, .mat-mdc-option, " +
    ".mdc-list-item, [role='menuitem'], .dropdown-item, li"
  )].filter(visible);

  const setCustomSelect = async (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") {
      return setNativeSelect(element, value);
    }

    element.focus?.();
    element.click();
    let option;
    for (let attempt = 0; attempt < 40; attempt++) {
      option = openOptions().find(candidate => optionMatches(candidate, value));
      if (option) break;
      await wait(50);
    }
    if (!option) {
      element.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return false;
    }

    // A real click is important for Angular Material: setting the combobox
    // value directly does not update its FormControl.
    option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, composed: true }));
    option.click();
    option.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, composed: true }));
    await wait(100);
    return normalize(element.textContent) === normalize(value) ||
      normalize(element.getAttribute("aria-label")) === normalize(value) ||
      !!element.getAttribute("aria-activedescendant");
  };

  const scoreFor = (element, keywords) => {
    const label = textFor(element);
    return keywords.reduce((score, keyword) =>
      score + (label.includes(normalize(keyword)) ? 1 : 0), 0);
  };

  const bestField = (available, keywords, used, predicate = () => true) => {
    let selected = null;
    let bestScore = 0;
    for (const element of available) {
      if (used.has(element) || !predicate(element)) continue;
      const score = scoreFor(element, keywords);
      if (score > bestScore) {
        selected = element;
        bestScore = score;
      }
    }
    if (selected) used.add(selected);
    return selected;
  };

  const fillPilgrim = async (root, pilgrim) => {
    const available = fields(root || document);
    const used = new Set();
    let count = 0;
    const textField = element => !isSelect(element);
    const selectField = element => isSelect(element);

    const name = bestField(available,
      ["pilgrim name", "devotee name", "full name", "traveller name", "name"], used, textField);
    const age = bestField(available, ["age", "years"], used, textField);
    const gender = bestField(available, ["gender", "sex"], used, selectField);
    const proof = bestField(available,
      ["photo id proof", "photoidproof", "id proof", "proof type", "document type", "identity proof"],
      used, selectField);
    const number = bestField(available,
      ["photo id number", "photoidnumber", "id number", "proof id number", "document number", "identity number"],
      used, textField);

    if (setInputValue(name, pilgrim.name)) count++;
    if (setInputValue(age, pilgrim.age)) count++;
    if (await setCustomSelect(gender, pilgrim.gender)) count++;
    if (await setCustomSelect(proof, pilgrim.idType)) count++;
    if (setInputValue(number, pilgrim.idNumber)) count++;
    return count;
  };

  const findGroups = expected => {
    if (!expected) return [];
    const all = fields(document);
    const candidates = [...document.querySelectorAll(
      "fieldset, section, article, li, tr, .row, [class*='pilgrim'], " +
      "[class*='passenger'], [class*='devotee']"
    )].filter(visible).filter(group => fields(group).length >= 3);
    const groups = [];
    for (const group of candidates) {
      if (!groups.some(existing => existing.contains(group))) groups.push(group);
      if (groups.length >= expected) return groups.slice(0, expected);
    }
    const size = Math.max(1, Math.ceil(all.length / expected));
    return Array.from({ length: expected }, (_, index) => ({
      querySelectorAll: () => all.slice(index * size, (index + 1) * size),
      contains: () => false
    }));
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "fill") return;
    (async () => {
      try {
        const pilgrims = Array.isArray(message.profile?.pilgrims) ? message.profile.pilgrims : [];
        const groups = findGroups(pilgrims.length);
        let filled = 0;
        for (const [index, pilgrim] of pilgrims.entries()) {
          filled += await fillPilgrim(groups[index] || document, pilgrim);
        }
        sendResponse({ message: filled
          ? `Filled ${filled} field(s) for ${pilgrims.length} pilgrim(s). Review all details before continuing.`
          : "No matching fields found. Check the page and form labels." });
      } catch (error) {
        console.error("TTD Smart Autofill:", error);
        sendResponse({ message: "Could not fill this page. Please review manually." });
      }
    })();
    return true;
  });
})();

(() => {
  const normalize = value => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const visible = element => {
    if (!element || element.disabled) return false;
    try {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      const hiddenByStyle = style.visibility === "hidden" || style.display === "none";
      const hiddenByAttribute = element.closest("[hidden], [aria-hidden='true']");
      return rect.width > 0 || rect.height > 0 ? !hiddenByStyle && !hiddenByAttribute : !hiddenByAttribute;
    } catch (error) {
      return !!element;
    }
  };

  const fields = root => [...(root || document).querySelectorAll(
    "input, select, textarea, [role='combobox'], [aria-haspopup='listbox'], mat-select, [contenteditable='true']"
  )].filter(visible);

  const textFor = element => {
    const values = [];
    if (element?.labels) [...element.labels].forEach(label => values.push(label.innerText));
    [
      "aria-label",
      "aria-labelledby",
      "placeholder",
      "name",
      "id",
      "formcontrolname",
      "ng-reflect-name",
      "data-name"
    ].forEach(attribute => {
      const value = element?.getAttribute(attribute);
      if (value) values.push(value);
    });

    const labelledBy = element?.getAttribute("aria-labelledby");
    if (labelledBy) {
      labelledBy.split(/\s+/).forEach(id => {
        const label = document.getElementById(id);
        if (label?.innerText) values.push(label.innerText);
      });
    }

    const parent = element?.closest("div, td, li, tr, section, article, fieldset, label");
    if (parent?.innerText) {
      const text = parent.innerText.trim();
      if (text.length > 0 && text.length <= 240) values.push(text);
    }

    return normalize(values.join(" "));
  };

  const emit = (element, type) => {
    if (!element) return;
    try {
      element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    } catch (error) {
      // ignore dispatch issues on some browsers
    }
  };

  const setNativeValue = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const stringValue = String(value).trim();
    if (!stringValue) return false;

    if (element instanceof HTMLSelectElement || element.tagName?.toLowerCase() === "select") {
      const option = [...element.options].find(candidate => {
        const candValue = normalize(candidate.value);
        const candText = normalize(candidate.textContent);
        return candValue === normalize(stringValue) || candText === normalize(stringValue);
      });
      if (!option) return false;
      element.value = option.value;
      emit(element, "input");
      emit(element, "change");
      emit(element, "blur");
      return true;
    }

    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, stringValue);
    else element.value = stringValue;

    emit(element, "input");
    emit(element, "change");
    emit(element, "blur");
    return true;
  };

  const scoreFor = (element, keywords) => {
    if (!element) return 0;
    const label = textFor(element);
    return keywords.reduce((total, keyword) => total + (label.includes(normalize(keyword)) ? 1 : 0), 0);
  };

  const bestField = (available, keywords, used = new Set()) => {
    let selected = null;
    let bestScore = -1;
    for (const element of available) {
      if (used.has(element)) continue;
      const current = scoreFor(element, keywords);
      if (current > bestScore) {
        selected = element;
        bestScore = current;
      }
    }
    if (selected) used.add(selected);
    return selected;
  };

  const fillGeneralDetails = details => {
    const available = fields(document);
    const used = new Set();
    let count = 0;

    const mappings = [
      [["email id", "email address", "email"], "email"],
      [["gothram", "gotram", "gotra"], "gothram"],
      [["city"], "city"],
      [["state", "province"], "state"],
      [["country"], "country"],
      [["pincode", "pin code", "postal code", "zip code", "zipcode"], "pincode"]
    ];

    for (const [keywords, key] of mappings) {
      const value = details?.[key];
      if (value === undefined || value === null || value === "") continue;
      const field = bestField(available, keywords, used);
      if (field && setNativeValue(field, value)) count++;
    }
    return count;
  };

  const fillPilgrim = (root, pilgrim) => {
    if (!pilgrim) return 0;
    const available = fields(root || document);
    const used = new Set();
    let count = 0;

    const mappings = [
      [["pilgrim name", "devotee name", "full name", "traveller name", "name"], pilgrim.name],
      [["age", "years"], pilgrim.age],
      [["gender", "sex"], pilgrim.gender],
      [["photo id proof", "id proof", "proof type", "document type", "identity proof", "proof"], pilgrim.idType],
      [["photo id number", "id number", "proof id number", "document number", "identity number"], pilgrim.idNumber]
    ];

    for (const [keywords, value] of mappings) {
      const field = bestField(available, keywords, used);
      if (field && setNativeValue(field, value)) count++;
    }
    return count;
  };

  const findGroups = expected => {
    if (!expected) return [];

    const all = fields(document);
    const groupCandidates = [...document.querySelectorAll(
      "fieldset, section, article, li, tr, .row, [class*='pilgrim'], [class*='passenger'], [class*='devotee']"
    )].filter(group => fields(group).length >= 3);

    const unique = [];
    for (const group of groupCandidates) {
      if (!unique.some(existing => existing.contains(group))) unique.push(group);
      if (unique.length >= expected) break;
    }

    if (unique.length >= expected) return unique.slice(0, expected);

    const nonGeneral = all.filter(element => scoreFor(element, ["email", "city", "state", "country", "pincode", "gothram"]) === 0);
    const fallback = [];
    for (let index = 0; index + 4 < nonGeneral.length && fallback.length < expected; index += 5) {
      const chunk = nonGeneral.slice(index, index + 5);
      if (chunk.some(element => scoreFor(element, ["name"]) > 0)) {
        fallback.push({ querySelectorAll: () => chunk, contains: () => true });
      }
    }

    return fallback.length >= expected ? fallback.slice(0, expected) : unique.slice(0, expected);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "fill") return;

    (async () => {
      try {
        const profile = message.profile || {};
        const pilgrims = Array.isArray(profile.pilgrims) ? profile.pilgrims : [];

        let filled = 0;
        filled += fillGeneralDetails(profile.generalDetails || {});

        const groups = findGroups(pilgrims.length);
        for (const [index, pilgrim] of pilgrims.entries()) {
          filled += fillPilgrim(groups[index] || document, pilgrim);
        }

        sendResponse({
          message: filled
            ? `Filled ${filled} field(s). Review all details before continuing.`
            : "No matching fields found. Check the page and form fields."
        });
      } catch (error) {
        console.error("TTD Smart Autofill:", error);
        sendResponse({ message: "Could not fill this page. Please review manually." });
      }
    })();

    return true;
  });
})();

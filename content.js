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
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) labelledBy.split(/\s+/).forEach(id => {
      const label = document.getElementById(id);
      if (label) values.push(label.innerText);
    });
    const parent = element.closest("div, td, li, section, article");
    if (parent && parent.innerText && parent.innerText.length < 160) values.push(parent.innerText);
    return normalize(values.join(" "));
  };

  const emit = (element, type) => element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));

  const setNativeValue = (element, value) => {
    const stringValue = String(value);
    if (element instanceof HTMLSelectElement) {
      const option = [...element.options].find(candidate =>
        normalize(candidate.value) === normalize(stringValue) || normalize(candidate.textContent) === normalize(stringValue)
      );
      if (!option) return false;
      element.value = option.value;
      emit(element, "input");
      emit(element, "change");
      return true;
    }

    if (element.matches("mat-select, [role='combobox'], [aria-haspopup='listbox']") && !("value" in element)) {
      element.click();
      const wanted = normalize(stringValue);
      const option = [...document.querySelectorAll("mat-option, [role='option'], option")].find(candidate =>
        visible(candidate) && (normalize(candidate.textContent) === wanted || normalize(candidate.getAttribute("value")) === wanted)
      );
      if (option) {
        option.click();
        return true;
      }
      return false;
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

  const score = (element, keywords) => {
    const label = textFor(element);
    return keywords.reduce((total, keyword) => total + (label.includes(normalize(keyword)) ? 1 : 0), 0);
  };

  const best = (available, keywords, used = new Set()) => {
    let selected = null;
    let bestScore = 0;
    for (const element of available) {
      if (used.has(element)) continue;
      const current = score(element, keywords);
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
      [["city"], "city"],
      [["state"], "state"],
      [["country"], "country"],
      [["pincode", "pin code", "postal code", "zip code", "zipcode"], "pincode"],
      [["gothram", "gotram", "gotra"], "gothram"]
    ];
    for (const [keywords, key] of mappings) {
      const element = best(available, keywords, used);
      if (element && setNativeValue(element, details?.[key])) count++;
    }
    return count;
  };

  const fillPilgrim = (root, pilgrim) => {
    const available = fields(root);
    const used = new Set();
    let count = 0;
    const mappings = [
      [["pilgrim name", "devotee name", "full name", "name"], pilgrim?.name],
      [["age", "years"], pilgrim?.age],
      [["gender", "sex"], pilgrim?.gender],
      [["photo id proof", "id proof", "proof type", "document type", "identity proof"], pilgrim?.idType],
      [["photo id number", "id number", "proof id number", "document number", "identity number"], pilgrim?.idNumber]
    ];
    for (const [keywords, value] of mappings) {
      const element = best(available, keywords, used);
      if (element && setNativeValue(element, value)) count++;
    }
    return count;
  };

  const findGroups = expected => {
    if (!expected) return [];
    const all = fields(document);
    const nameFields = all.filter(element => score(element, ["name"]) > 0 && score(element, ["email"]) === 0);
    const groups = [];

    for (const nameField of nameFields) {
      let parent = nameField.parentElement;
      let candidate = null;
      while (parent && parent !== document.body) {
        const contained = fields(parent);
        if (contained.length >= 5 && contained.length <= 8) candidate = parent;
        if (contained.length > 8) break;
        parent = parent.parentElement;
      }
      if (candidate && !groups.includes(candidate)) groups.push(candidate);
    }

    if (groups.length >= expected) return groups.slice(0, expected);

    // Angular layouts sometimes have no useful row wrapper. Fall back to the
    // ordered controls: each pilgrim is five adjacent controls on this page.
    const nonGeneral = all.filter(element => !score(element, ["email", "city", "state", "country", "pincode", "gothram"]));
    const fallback = [];
    for (let index = 0; index + 4 < nonGeneral.length && fallback.length < expected; index += 5) {
      const chunk = nonGeneral.slice(index, index + 5);
      if (chunk.some(element => score(element, ["name"]) > 0)) {
        fallback.push({ querySelectorAll: () => chunk, contains: () => true });
      }
    }
    return fallback.length >= expected ? fallback : groups;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action !== "fill") return;
    try {
      const pilgrims = Array.isArray(message.profile?.pilgrims) ? message.profile.pilgrims : [];
      let filled = fillGeneralDetails(message.profile?.generalDetails || {});
      const groups = findGroups(pilgrims.length);
      pilgrims.forEach((pilgrim, index) => {
        filled += fillPilgrim(groups[index] || document, pilgrim);
      });
      sendResponse({
        message: filled
          ? `Filled ${filled} field(s), including general details. Review all details before continuing.`
          : "No matching fields found. Check the page and form fields."
      });
    } catch (error) {
      console.error("TTD Smart Autofill:", error);
      sendResponse({ message: "Could not fill this page. Please review manually." });
    }
    return true;
  });
})();

(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
  };
  const click = element => {
    if (!element || !visible(element)) return false;
    element.scrollIntoView?.({ block: "center", inline: "nearest" });
    element.click();
    return true;
  };

  const dialog = () => [...document.querySelectorAll(".ui-dialog.add-passenger-dialog, .add-passenger-dialog.ui-dialog, [role='dialog']")].find(visible);
  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(element, String(value)); else element.value = String(value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const fields = root => [...root.querySelectorAll("p-dropdown, .ui-dropdown, [role='combobox'], .mat-select")];
  const fieldFor = (root, names, label) => fields(root).find(field => {
    const formName = normalize(field.getAttribute("formcontrolname"));
    if (names.includes(formName)) return true;
    let parent = field.parentElement;
    for (let i = 0; i < 4 && parent; i++, parent = parent.parentElement) {
      if (normalize(parent.textContent).includes(normalize(label))) return true;
    }
    return false;
  });
  const selected = field => normalize(field?.querySelector(".ui-dropdown-label:not(.ui-placeholder), .p-dropdown-label, [role='option']")?.textContent || "");
  const options = () => [...document.querySelectorAll(".ui-dropdown-panel li, .ui-dropdown-item, .p-dropdown-items li, li[role='option'], [role='option']")].filter(visible);

  const choose = async (root, names, label, value) => {
    if (!value) return true;
    const field = fieldFor(root, names, label);
    if (!field) return false;
    const wanted = normalize(value);
    if (selected(field) === wanted) return true;
    const trigger = field.querySelector(".ui-dropdown-trigger, .ui-dropdown-label-container, .p-dropdown-trigger, [role='combobox']") || field;
    if (!click(trigger)) return false;
    for (let i = 0; i < 60; i++) {
      const option = options().find(item => normalize(item.textContent) === wanted);
      if (option && click(option)) {
        for (let j = 0; j < 30; j++) {
          await wait(50);
          if (selected(field) === wanted) return true;
        }
        return false;
      }
      await wait(50);
    }
    return false;
  };

  const fillPassenger = async passenger => {
    const root = dialog();
    if (!root) return null;
    const name = root.querySelector("input[formcontrolname='passengerName'], input[placeholder*='Full Name' i], input[placeholder*='Govt' i], input[aria-label*='Name' i]");
    const age = root.querySelector("input[formcontrolname='passengerAge'], input[placeholder*='age' i], input[type='number']");
    return {
      nameOk: setInput(name, passenger.name),
      ageOk: setInput(age, passenger.age),
      genderOk: await choose(root, ["passengergender", "gender"], "gender", passenger.gender),
      countryOk: await choose(root, ["passengernationality", "nationality", "country"], "country", passenger.country || "India"),
      preferenceOk: !passenger.preference || await choose(root, ["passengerberthchoice", "berthchoice", "preference"], "preference", passenger.preference)
    };
  };

  const newPassenger = () => [...document.querySelectorAll("button.btn-new-passenger, button")].find(button => visible(button) && normalize(button.textContent).includes("new passenger"));
  const addPassenger = () => {
    const root = dialog();
    return root?.querySelector("button.ap-add-btn, button[type='submit'], .ap-add-btn") || [...(root?.querySelectorAll("button, [role='button']") || [])].find(button => /^(add|add passenger|save passenger)$/i.test(normalize(button.textContent)));
  };

  const openPassenger = async () => {
    if (!click(newPassenger())) return false;
    for (let i = 0; i < 60; i++) { if (dialog()) return true; await wait(50); }
    return false;
  };
  const submitPassenger = async () => {
    const button = addPassenger();
    if (!click(button)) return false;
    for (let i = 0; i < 50; i++) { await wait(100); if (!dialog() || !visible(button)) return true; }
    return !dialog();
  };

  // IRCTC renders Other Preferences as an accordion. Find its header and its
  // chevron/button, expand it, then locate the checkbox inside the matching card.
  const exactText = text => {
    const wanted = normalize(text);
    return [...document.querySelectorAll("h1,h2,h3,h4,label,span,p,div")]
      .filter(visible)
      .filter(element => normalize(element.textContent) === wanted)
      .sort((a, b) => a.textContent.length - b.textContent.length)[0] || null;
  };
  const preferenceCard = text => {
    const label = exactText(text);
    if (!label) return null;
    let node = label;
    for (let i = 0; i < 8 && node; i++, node = node.parentElement) {
      const input = node.querySelector?.("input[type='checkbox']");
      const role = node.querySelector?.("[role='checkbox']");
      if (input || role) return { card: node, control: input || role };
    }
    return { card: label.closest("label, article, [role='checkbox']") || label, control: null };
  };
  const otherPreferencesHeader = () => exactText("Other Preferences");
  const expandPreferences = async () => {
    for (let i = 0; i < 30; i++) {
      if (preferenceCard("Consider for Auto Upgradation") || preferenceCard("Book only if confirm berths are allotted")) return true;
      const header = otherPreferencesHeader();
      if (header) {
        const section = header.closest("section, article, .accordion, .card, .panel") || header.parentElement?.parentElement || header;
        const toggle = section.querySelector?.("button, [role='button'], input[type='button']") || header.closest("button, [role='button']") || header;
        click(toggle);
      }
      await wait(150);
    }
    return false;
  };
  const checked = control => control?.matches("input[type='checkbox']") ? control.checked : control?.getAttribute("aria-checked") === "true" || /checked|selected|active/.test(String(control?.className));
  const tick = async text => {
    for (let i = 0; i < 30; i++) {
      const match = preferenceCard(text);
      if (match) {
        if (!checked(match.control)) {
          const input = match.control || match.card.querySelector?.("input[type='checkbox'], [role='checkbox']");
          if (input) click(input);
          else click(match.card);
        }
        await wait(100);
        const current = match.control || match.card.querySelector?.("input[type='checkbox'], [role='checkbox']");
        if (checked(current) || !current) {
          // For custom cards without a readable state, the real click has been dispatched.
          return true;
        }
      }
      await wait(150);
    }
    return false;
  };
  const applyPreferences = async preferences => {
    if (!preferences?.autoUpgrade && !preferences?.confirmedBerths) return true;
    await expandPreferences();
    const autoOk = !preferences.autoUpgrade || await tick("Consider for Auto Upgradation");
    const confirmOk = !preferences.confirmedBerths || await tick("Book only if confirm berths are allotted");
    return autoOk && confirmOk;
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        if (message.action === "selectExistingPassengers") { sendResponse({ message: "Select existing passengers manually from the IRCTC list." }); return; }
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (!passengers.length) { sendResponse({ message: "Add at least one passenger to the profile." }); return; }
        let completed = 0;
        for (const passenger of passengers) {
          if (!await openPassenger()) break;
          const result = await fillPassenger(passenger);
          if (!result || !result.nameOk || !result.ageOk || !result.genderOk || !result.countryOk || !result.preferenceOk) {
            const missing = [!result?.nameOk && "Name", !result?.ageOk && "Age", !result?.genderOk && "Gender", !result?.countryOk && "Country", !result?.preferenceOk && "Preference"].filter(Boolean).join(", ");
            sendResponse({ message: `Passenger ${completed + 1} could not be completed. Check: ${missing}.` });
            return;
          }
          if (!await submitPassenger()) { sendResponse({ message: `Passenger ${completed + 1} was filled, but Add did not complete.` }); return; }
          completed++;
        }
        if (completed !== passengers.length) { sendResponse({ message: `Filled ${completed} of ${passengers.length} passenger(s).` }); return; }
        const preferencesOk = await applyPreferences(message.preferences);
        sendResponse({ message: `Added and filled ${completed} passenger(s). ${preferencesOk ? "Requested preferences selected." : "Please check the requested preferences manually."}` });
      } catch (error) {
        console.error("IRCTC Passenger Autofill:", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();

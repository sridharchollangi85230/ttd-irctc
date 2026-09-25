(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
  };

  const dialog = () => [...document.querySelectorAll(".ui-dialog.add-passenger-dialog, .add-passenger-dialog.ui-dialog")].find(visible);
  const dropdown = name => dialog()?.querySelector(`p-dropdown[formcontrolname="${name}"]`) || null;
  const selectedText = field => normalize(field?.querySelector(".ui-dropdown-label:not(.ui-placeholder)")?.textContent || "");

  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(element, String(value)); else element.value = String(value);
    ["input", "change", "blur"].forEach(type => element.dispatchEvent(new Event(type, { bubbles: true, composed: true })));
    return true;
  };

  const clickOnce = element => {
    if (!element) return false;
    element.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    element.click();
    return true;
  };

  const visiblePanels = () => [...document.querySelectorAll(".ui-dropdown-panel, .ap-dropdown-panel, .ui-dropdown-items-wrapper, [role='listbox']")].filter(visible);
  const panelOptions = () => visiblePanels().flatMap(panel => [...panel.querySelectorAll("li.ui-dropdown-item, li[role='option'], .ui-dropdown-item, [role='option']")]).filter(visible).filter(item => normalize(item.textContent));

  const chooseDropdown = async (name, value) => {
    const field = dropdown(name);
    if (!field || !value) return false;
    const wanted = normalize(value);
    if (selectedText(field) === wanted) return true;
    const trigger = field.querySelector(".ui-dropdown-trigger") || field.querySelector(".ui-dropdown-label-container");
    if (!clickOnce(trigger)) return false;
    let option = null;
    for (let attempt = 0; attempt < 60 && !option; attempt++) {
      option = panelOptions().find(item => normalize(item.textContent) === wanted);
      if (!option) await wait(50);
    }
    if (!option) return false;
    clickOnce(option);
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(50);
      if (selectedText(field) === wanted) return true;
    }
    return false;
  };

  const fillPassenger = async passenger => {
    const root = dialog();
    if (!root) return { nameOk: false, ageOk: false, genderOk: false, countryOk: false, preferenceOk: false };
    const nameOk = setInput(root.querySelector("input[formcontrolname='passengerName'], p-autocomplete input[role='searchbox']"), passenger.name);
    const ageOk = setInput(root.querySelector("input[formcontrolname='passengerAge']"), passenger.age);
    const genderOk = await chooseDropdown("passengerGender", passenger.gender);
    const countryOk = await chooseDropdown("passengerNationality", passenger.country || "India");
    const preferenceOk = await chooseDropdown("passengerBerthChoice", passenger.preference);
    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const newPassengerButton = () => [...document.querySelectorAll("button.btn-new-passenger")].find(visible);
  const addButton = () => dialog()?.querySelector("button.ap-add-btn");

  const openPassenger = async () => {
    const button = newPassengerButton();
    if (!button) return false;
    clickOnce(button);
    for (let attempt = 0; attempt < 40; attempt++) {
      if (dialog()) return true;
      await wait(50);
    }
    return false;
  };

  const addPassenger = async () => {
    const button = addButton();
    if (!button || !visible(button)) return false;
    clickOnce(button);
    await wait(500);
    return !dialog();
  };

  const checkboxForText = text => {
    const wanted = normalize(text);
    const controls = [...document.querySelectorAll("input[type='checkbox'], [role='checkbox']")];
    for (const control of controls) {
      // Avoid a template selector here: some extension loaders report a parse
      // error for the older label[for] template expression.
      const label = control.closest("label") || [...document.querySelectorAll("label")].find(item => item.htmlFor === control.id);
      const container = label || control.parentElement?.parentElement || control.parentElement;
      if (normalize(container?.textContent).includes(wanted)) return control;
    }
    const labels = [...document.querySelectorAll("label, p-checkbox, .checkbox, [class*='checkbox']")];
    const label = labels.find(element => normalize(element.textContent).includes(wanted));
    if (!label) return null;
    return label.querySelector("input[type='checkbox'], [role='checkbox']") || label;
  };

  const checked = control => control?.matches("input[type='checkbox']") ? control.checked : control?.getAttribute("aria-checked") === "true";

  const tickOption = async text => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const control = checkboxForText(text);
      if (control) {
        if (!checked(control)) clickOnce(control);
        for (let check = 0; check < 20; check++) {
          if (checked(control)) return true;
          await wait(50);
        }
      }
      await wait(50);
    }
    return false;
  };

  const applyOtherPreferences = async () => ({
    autoUpgrade: await tickOption("Consider for Auto Upgradation"),
    confirmedBerths: await tickOption("Book only if confirm berths are allotted")
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        if (message.action === "selectExistingPassengers") {
          sendResponse({ message: "Select existing passengers manually from the IRCTC list." });
          return;
        }
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (!passengers.length) {
          sendResponse({ message: "Add at least one passenger to the profile." });
          return;
        }
        let completed = 0;
        for (const passenger of passengers) {
          if (!await openPassenger()) break;
          const result = await fillPassenger(passenger);
          if (!result.nameOk || !result.ageOk || !result.genderOk || !result.countryOk || !result.preferenceOk) {
            const missing = [!result.nameOk && "Name", !result.ageOk && "Age", !result.genderOk && "Gender", !result.countryOk && "Country", !result.preferenceOk && "Preference"].filter(Boolean).join(", ");
            sendResponse({ message: `Passenger ${completed + 1} could not be completed. Check: ${missing}.` });
            return;
          }
          if (!await addPassenger()) break;
          completed++;
        }
        if (completed !== passengers.length) {
          sendResponse({ message: `Filled ${completed} of ${passengers.length} passenger(s). Review the page and complete the remaining steps manually.` });
          return;
        }
        const preferences = await applyOtherPreferences();
        const preferenceStatus = preferences.autoUpgrade && preferences.confirmedBerths ? "Both booking preferences were selected." : "Passenger details were filled, but one or more booking preferences could not be selected; please check them manually.";
        sendResponse({ message: `Added and filled ${completed} passenger(s). ${preferenceStatus} Review all details before continuing.` });
      } catch (error) {
        console.error("IRCTC Passenger Autofill:", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();

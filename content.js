(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = element => {
    if (!element || element.disabled) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
  };
  const clickOnce = element => {
    if (!element || !visible(element)) return false;
    element.scrollIntoView?.({ block: "center", inline: "nearest" });
    element.click();
    return true;
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
  const panels = () => [...document.querySelectorAll(".ui-dropdown-panel, .ap-dropdown-panel, .ui-dropdown-items-wrapper, [role='listbox']")].filter(visible);
  const options = () => panels().flatMap(panel => [...panel.querySelectorAll("li.ui-dropdown-item, li[role='option'], .ui-dropdown-item, [role='option']")]).filter(visible);

  const chooseDropdown = async (name, value) => {
    const field = dropdown(name);
    if (!field || !value) return false;
    const wanted = normalize(value);
    if (selectedText(field) === wanted) return true;
    if (!clickOnce(field.querySelector(".ui-dropdown-trigger") || field.querySelector(".ui-dropdown-label-container"))) return false;
    let option;
    for (let attempt = 0; attempt < 60 && !option; attempt++) {
      option = options().find(item => normalize(item.textContent) === wanted);
      if (!option) await wait(50);
    }
    if (!option || !clickOnce(option)) return false;
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
    const preferenceOk = passenger.preference ? await chooseDropdown("passengerBerthChoice", passenger.preference) : true;
    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const newPassengerButton = () => [...document.querySelectorAll("button.btn-new-passenger")].find(visible);
  const addButton = () => dialog()?.querySelector("button.ap-add-btn");
  const openPassenger = async () => {
    const button = newPassengerButton();
    if (!clickOnce(button)) return false;
    for (let attempt = 0; attempt < 40; attempt++) {
      if (dialog()) return true;
      await wait(50);
    }
    return false;
  };
  const addPassenger = async () => {
    const button = addButton();
    if (!clickOnce(button)) return false;
    await wait(500);
    return !dialog();
  };

  // IRCTC uses custom checkbox markup. Find the smallest visible element whose
  // text is the requested option, then click its checkbox or card container.
  const preferenceText = text => {
    const wanted = normalize(text);
    return [...document.querySelectorAll("label, span, p, div")].find(element => {
      if (!visible(element)) return false;
      const value = normalize(element.textContent);
      return value === wanted || (value.includes(wanted) && value.length <= wanted.length + 70);
    });
  };
  const preferenceControl = text => {
    const textElement = preferenceText(text);
    if (!textElement) return null;
    let node = textElement;
    for (let level = 0; level < 7 && node; level++, node = node.parentElement) {
      const input = node.querySelector("input[type='checkbox']");
      if (input) return input;
      const roleCheckbox = node.querySelector("[role='checkbox']");
      if (roleCheckbox) return roleCheckbox;
      if (node.matches("label")) return node;
    }
    return textElement.closest("label, [role='checkbox'], button") || textElement;
  };
  const isChecked = control => {
    if (!control) return false;
    if (control.matches("input[type='checkbox']")) return control.checked;
    return control.getAttribute("aria-checked") === "true" || /checked|selected|active/.test(String(control.className));
  };
  const openOtherPreferences = async () => {
    if (preferenceText("Consider for Auto Upgradation") || preferenceText("Book only if confirm berths are allotted")) return true;
    const heading = [...document.querySelectorAll("h1,h2,h3,h4,button,div,span")].find(element => normalize(element.textContent) === "other preferences" && visible(element));
    if (heading) clickOnce(heading.closest("button, [role='button'], .card-header, .accordion-header") || heading);
    for (let attempt = 0; attempt < 30; attempt++) {
      if (preferenceText("Consider for Auto Upgradation") || preferenceText("Book only if confirm berths are allotted")) return true;
      await wait(100);
    }
    return false;
  };
  const tickPreference = async text => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const control = preferenceControl(text);
      if (control) {
        if (!isChecked(control)) {
          const input = control.matches("input[type='checkbox']") ? control : control.querySelector?.("input[type='checkbox']");
          clickOnce(input || control);
        }
        for (let check = 0; check < 20; check++) {
          if (isChecked(control) || (control.querySelector && isChecked(control.querySelector("input[type='checkbox']")))) return true;
          await wait(50);
        }
      }
      await wait(100);
    }
    return false;
  };
  const applyPreferences = async preferences => {
    await openOtherPreferences();
    return {
      autoUpgrade: !preferences?.autoUpgrade || await tickPreference("Consider for Auto Upgradation"),
      confirmedBerths: !preferences?.confirmedBerths || await tickPreference("Book only if confirm berths are allotted")
    };
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!["fillPassengers", "selectExistingPassengers"].includes(message.action)) return;
    (async () => {
      try {
        if (message.action === "selectExistingPassengers") {
          sendResponse({ message: "Select existing passengers manually from the IRCTC list." });
          return;
        }
        const passengers = Array.isArray(message.passengers) ? message.passengers : [];
        if (!passengers.length) { sendResponse({ message: "Add at least one passenger to the profile." }); return; }
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
          sendResponse({ message: `Filled ${completed} of ${passengers.length} passenger(s). Review the remaining steps manually.` });
          return;
        }
        const result = await applyPreferences(message.preferences);
        const ok = result.autoUpgrade && result.confirmedBerths;
        sendResponse({ message: `Added and filled ${completed} passenger(s). ${ok ? "Requested Other Preferences were selected." : "One or more requested Other Preferences could not be selected; please check them manually."}` });
      } catch (error) {
        console.error("IRCTC Passenger Autofill:", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();

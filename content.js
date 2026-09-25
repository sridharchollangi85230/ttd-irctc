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

  const dialog = () => [...document.querySelectorAll(
    ".ui-dialog.add-passenger-dialog, .add-passenger-dialog.ui-dialog, [role='dialog']"
  )].find(visible);

  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
    if (setter) setter.call(element, String(value));
    else element.value = String(value);
    ["input", "change", "blur"].forEach(type => {
      element.dispatchEvent(new Event(type, { bubbles: true, composed: true }));
    });
    return true;
  };

  const dropdownFields = root => [...root.querySelectorAll(
    "p-dropdown, .ui-dropdown, [role='combobox'], .mat-select"
  )];

  const dropdownFor = (root, names, labelText) => {
    const field = dropdownFields(root).find(element => {
      const formName = normalize(element.getAttribute("formcontrolname"));
      return names.includes(formName);
    });
    if (field) return field;

    const wanted = normalize(labelText);
    return dropdownFields(root).find(element => {
      let container = element.parentElement;
      for (let level = 0; level < 3 && container; level++, container = container.parentElement) {
        if (normalize(container.textContent).includes(wanted)) return true;
      }
      return false;
    });
  };

  const selectedText = field => normalize(
    field?.querySelector(".ui-dropdown-label:not(.ui-placeholder), .p-dropdown-label, [role='option']")?.textContent || ""
  );

  const dropdownOptions = () => [...document.querySelectorAll(
    ".ui-dropdown-panel li, .ui-dropdown-item, .p-dropdown-items li, li[role='option'], [role='option']"
  )].filter(visible).filter(option => normalize(option.textContent));

  const chooseDropdown = async (root, names, labelText, value) => {
    if (!value) return true;
    const field = dropdownFor(root, names, labelText);
    if (!field) return false;
    const wanted = normalize(value);
    if (selectedText(field) === wanted) return true;

    const trigger = field.querySelector(
      ".ui-dropdown-trigger, .ui-dropdown-label-container, .p-dropdown-trigger, [role='combobox']"
    ) || field;
    if (!clickOnce(trigger)) return false;

    let option = null;
    for (let attempt = 0; attempt < 60 && !option; attempt++) {
      option = dropdownOptions().find(item => normalize(item.textContent) === wanted);
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
    if (!root) return null;

    const name = root.querySelector(
      "input[formcontrolname='passengerName'], input[placeholder*='Full Name' i], input[placeholder*='Govt' i], input[aria-label*='Name' i]"
    );
    const age = root.querySelector(
      "input[formcontrolname='passengerAge'], input[placeholder*='age' i], input[type='number']"
    );

    return {
      nameOk: setInput(name, passenger.name),
      ageOk: setInput(age, passenger.age),
      genderOk: await chooseDropdown(root, ["passengergender", "gender"], "gender", passenger.gender),
      countryOk: await chooseDropdown(root, ["passengernationality", "nationality", "country"], "country", passenger.country || "India"),
      preferenceOk: !passenger.preference || await chooseDropdown(root, ["passengerberthchoice", "berthchoice", "preference"], "preference", passenger.preference)
    };
  };

  const newPassengerButton = () => [...document.querySelectorAll("button.btn-new-passenger, button")]
    .find(button => visible(button) && normalize(button.textContent).includes("new passenger"));

  const addPassengerButton = () => [...document.querySelectorAll("button")]
    .find(button => visible(button) && /add passenger|save passenger/i.test(button.textContent));

  const openPassenger = async () => {
    if (!clickOnce(newPassengerButton())) return false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (dialog()) return true;
      await wait(50);
    }
    return false;
  };

  const addPassenger = async () => {
    if (!clickOnce(addPassengerButton())) return false;
    for (let attempt = 0; attempt < 30; attempt++) {
      await wait(100);
      if (!dialog()) return true;
    }
    return false;
  };

  const textElement = text => {
    const wanted = normalize(text);
    return [...document.querySelectorAll("label, span, p, div")].find(element => {
      if (!visible(element)) return false;
      const actual = normalize(element.textContent);
      return actual === wanted || (actual.includes(wanted) && actual.length <= wanted.length + 80);
    });
  };

  const checkboxForText = text => {
    const labelText = textElement(text);
    if (!labelText) return null;
    let node = labelText;
    for (let level = 0; level < 8 && node; level++, node = node.parentElement) {
      const input = node.querySelector?.("input[type='checkbox']");
      if (input) return input;
      const roleCheckbox = node.querySelector?.("[role='checkbox']");
      if (roleCheckbox) return roleCheckbox;
    }
    return labelText.closest("label, [role='checkbox'], button") || labelText;
  };

  const isChecked = control => {
    if (!control) return false;
    if (control.matches("input[type='checkbox']")) return control.checked;
    return control.getAttribute("aria-checked") === "true" || /checked|selected|active/.test(String(control.className));
  };

  const ensureOtherPreferencesVisible = async () => {
    for (let attempt = 0; attempt < 30; attempt++) {
      if (textElement("Consider for Auto Upgradation") || textElement("Book only if confirm berths are allotted")) return true;
      const heading = textElement("Other Preferences");
      if (heading) clickOnce(heading.closest("button, [role='button'], .accordion-header") || heading);
      await wait(100);
    }
    return false;
  };

  const tickPreference = async text => {
    for (let attempt = 0; attempt < 40; attempt++) {
      const control = checkboxForText(text);
      if (control) {
        if (!isChecked(control)) clickOnce(control);
        for (let check = 0; check < 20; check++) {
          if (isChecked(control)) return true;
          await wait(50);
        }
      }
      await wait(100);
    }
    return false;
  };

  const applyPreferences = async preferences => {
    if (!preferences?.autoUpgrade && !preferences?.confirmedBerths) return true;
    await ensureOtherPreferencesVisible();
    const autoUpgradeOk = !preferences.autoUpgrade || await tickPreference("Consider for Auto Upgradation");
    const confirmedBerthsOk = !preferences.confirmedBerths || await tickPreference("Book only if confirm berths are allotted");
    return autoUpgradeOk && confirmedBerthsOk;
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
        if (!passengers.length) {
          sendResponse({ message: "Add at least one passenger to the profile." });
          return;
        }

        let completed = 0;
        for (const passenger of passengers) {
          if (!await openPassenger()) break;
          const result = await fillPassenger(passenger);
          if (!result || !result.nameOk || !result.ageOk || !result.genderOk || !result.countryOk || !result.preferenceOk) {
            const missing = [
              !result?.nameOk && "Name",
              !result?.ageOk && "Age",
              !result?.genderOk && "Gender",
              !result?.countryOk && "Country",
              !result?.preferenceOk && "Preference"
            ].filter(Boolean).join(", ");
            sendResponse({ message: `Passenger ${completed + 1} could not be completed. Check: ${missing}.` });
            return;
          }
          if (!await addPassenger()) break;
          completed++;
        }

        if (completed !== passengers.length) {
          sendResponse({ message: `Filled ${completed} of ${passengers.length} passenger(s).` });
          return;
        }

        const preferencesOk = await applyPreferences(message.preferences);
        sendResponse({
          message: `Added and filled ${completed} passenger(s). ${preferencesOk ? "Requested preferences selected." : "Please check the requested preferences manually."}`
        });
      } catch (error) {
        console.error("IRCTC Passenger Autofill:", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();

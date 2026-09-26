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

  const visiblePanels = () => [...document.querySelectorAll(
    ".ui-dropdown-panel, .ap-dropdown-panel, .ui-dropdown-items-wrapper, [role='listbox']"
  )].filter(visible);

  const panelOptions = () => visiblePanels().flatMap(panel => [
    ...panel.querySelectorAll("li.ui-dropdown-item, li[role='option'], .ui-dropdown-item, [role='option']")
  ]).filter(visible).filter(item => normalize(item.textContent));

  const chooseDropdown = async (name, value) => {
    const field = dropdown(name);
    if (!field || !value) return false;
    const wanted = normalize(value);
    if (selectedText(field) === wanted) return true;

    const trigger = field.querySelector(".ui-dropdown-trigger") || field.querySelector(".ui-dropdown-label-container");
    if (!clickOnce(trigger)) return false;

    const option = await (async () => {
      for (let attempt = 0; attempt < 60; attempt++) {
        const match = panelOptions().find(item => normalize(item.textContent) === wanted);
        if (match) return match;
        await wait(50);
      }
      return null;
    })();

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
    for (let attempt = 0; attempt < 40; attempt++) {
      await wait(100);
      if (!dialog()) return true;
      const errorText = normalize(dialog()?.textContent || "");
      if (errorText.includes("required") || errorText.includes("invalid") || errorText.includes("error")) return false;
    }
    return false;
  };

  const labelText = element => {
    const values = [];
    if (element.labels) {
      values.push(...[...element.labels].map(label => label.textContent));
    }
    const parent = element.closest("label, div, li, td, tr");
    if (parent) {
      values.push(parent.textContent);
    }
    return normalize(values.join(" "));
  };

  const clickPreferenceByText = text => {
    const wanted = normalize(text);
    const candidates = [
      ...document.querySelectorAll("label, span, div, p, li, td")
    ].filter(visible);
    const textElement = candidates.find(element => {
      const value = normalize(element.textContent);
      return value === wanted || value.includes(wanted);
    });
    if (!textElement) return false;
    const clickable = textElement.closest(
      "label, .ui-chkbox, .p-checkbox, .mat-checkbox, [role='checkbox']"
    ) || textElement;
    clickOnce(clickable);
    return true;
  };

  const selectBookingPreferences = async preferences => {
    const result = {
      autoUpgrade: true,
      confirmBerthsOnly: true
    };
    if (!preferences) return result;
    if (preferences.autoUpgrade === true) {
      result.autoUpgrade = clickPreferenceByText("Consider for Auto Upgradation");
    }
    if (preferences.confirmBerthsOnly === true) {
      result.confirmBerthsOnly = clickPreferenceByText("Book only if confirm berths are allotted");
    }
    await wait(300);
    return result;
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
        const preferences = message.bookingPreferences || { autoUpgrade: true, confirmBerthsOnly: true };
        const preferenceResult = await selectBookingPreferences(preferences);
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
        const preferenceMissing = [
          !preferenceResult.autoUpgrade && "Auto Upgradation",
          !preferenceResult.confirmBerthsOnly && "Confirm berths only"
        ].filter(Boolean);
        if (preferenceMissing.length) {
          sendResponse({
            message: `Filled ${completed} of ${passengers.length} passenger(s). Review these options manually: ${preferenceMissing.join(", ")}.`
          });
        } else {
          sendResponse({
            message: completed === passengers.length ? `Added and filled ${completed} passenger(s). All preferences set. Review all details before continuing.` : `Filled ${completed} of ${passengers.length} passenger(s).`
          });
        }
      } catch (error) {
        console.error("IRCTC Passenger Autofill:", error);
        sendResponse({ message: "Could not fill the passenger form. Please review manually." });
      }
    })();
    return true;
  });
})();
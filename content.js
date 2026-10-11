(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();

  const setInput = (element, value) => {
    if (!element || value === undefined || value === null || value === "") return false;
    const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(element, String(value));
    else element.value = String(value);
    ["input", "change", "blur", "focus"].forEach(type =>
      element.dispatchEvent(new Event(type, { bubbles: true, composed: true }))
    );
    return true;
  };

  const getDialog = () => {
    const dialogs = [
      ...document.querySelectorAll(".ui-dialog.add-passenger-dialog"),
      ...document.querySelectorAll(".add-passenger-dialog.ui-dialog"),
      ...document.querySelectorAll(".add-passenger-dialog"),
      ...document.querySelectorAll("[role='dialog'][class*='passenger']"),
      ...document.querySelectorAll(".modal[class*='passenger']"),
      ...document.querySelectorAll(".dialog[class*='passenger']")
    ];
    return dialogs.find(d => d && d.offsetParent !== null) || null;
  };

  const hasDirectPassengerForm = () => {
    const root = document;
    return !!(
      root.querySelector("input[formcontrolname='passengerName'], input[name='passengerName'], input[placeholder*='Full Name'], input[placeholder*='full name']") ||
      root.querySelector("input[formcontrolname='passengerAge'], input[name='passengerAge']") ||
      root.querySelector("select[formcontrolname='passengerGender'], select[name='passengerGender'], p-dropdown[formcontrolname='passengerGender']") ||
      root.querySelector("select[formcontrolname='passengerNationality'], select[name='passengerNationality'], p-dropdown[formcontrolname='passengerNationality']")
    );
  };

  const findInputByLabel = (labelText, container = null) => {
    const root = container || document;
    const labels = [...root.querySelectorAll("label")];
    const label = labels.find(l => normalize(l.textContent).includes(normalize(labelText)));
    if (!label) return null;
    const inputId = label.getAttribute("for");
    if (inputId) return root.querySelector(`#${inputId}`);
    return label.parentElement?.querySelector("input, textarea, select") || null;
  };

  const findSelectByLabel = (labelText, container = null) => {
    const root = container || document;
    const labels = [...root.querySelectorAll("label")];
    const label = labels.find(l => normalize(l.textContent).includes(normalize(labelText)));
    if (!label) return null;
    const selectId = label.getAttribute("for");
    if (selectId) return root.querySelector(`#${selectId}`);
    return label.parentElement?.querySelector("select") || null;
  };

  const selectDropdownOption = async (selectEl, wantedValue) => {
    if (!selectEl) return false;
    const target = normalize(wantedValue);

    if (selectEl.tagName === "SELECT") {
      const options = [...selectEl.options];
      const match = options.find(
        option => normalize(option.textContent) === target || normalize(option.value) === target
      );
      if (match) {
        selectEl.value = match.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        return true;
      }
      return false;
    }

    selectEl.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    selectEl.click();
    await wait(200);

    const allOptions = [
      ...document.querySelectorAll("li.ui-dropdown-item, li[role='option'], .ui-dropdown-item, [role='option']"),
      ...document.querySelectorAll(".dropdown-item, .select-item, [role='menuitem']")
    ].filter(el => el.offsetParent !== null && el.textContent);

    const matchedOption = allOptions.find(option => normalize(option.textContent) === target);
    if (matchedOption) {
      matchedOption.scrollIntoView?.({ block: "nearest" });
      matchedOption.click();
      await wait(200);
      return true;
    }
    return false;
  };

  const fillPassenger = async passenger => {
    const dialog = getDialog();
    const root = dialog || document;

    let nameInput =
      root.querySelector("input[formcontrolname='passengerName']") ||
      root.querySelector("input[name='passengerName']") ||
      root.querySelector("input[placeholder*='Full Name'], input[placeholder*='full name']");
    if (!nameInput) nameInput = findInputByLabel("full name", root);
    const nameOk = setInput(nameInput, passenger.name);

    let ageInput =
      root.querySelector("input[formcontrolname='passengerAge']") ||
      root.querySelector("input[name='passengerAge']") ||
      root.querySelector("input[type='number']");
    if (!ageInput) ageInput = findInputByLabel("age", root);
    const ageOk = setInput(ageInput, passenger.age);

    let genderSelect =
      root.querySelector("select[formcontrolname='passengerGender']") ||
      root.querySelector("select[name='passengerGender']") ||
      root.querySelector("p-dropdown[formcontrolname='passengerGender']");
    if (!genderSelect) genderSelect = findSelectByLabel("gender", root);
    const genderOk = genderSelect ? await selectDropdownOption(genderSelect, passenger.gender || "Male") : false;

    let countrySelect =
      root.querySelector("select[formcontrolname='passengerNationality']") ||
      root.querySelector("select[name='passengerNationality']") ||
      root.querySelector("p-dropdown[formcontrolname='passengerNationality']");
    if (!countrySelect) countrySelect = findSelectByLabel("country", root);
    const countryOk = countrySelect ? await selectDropdownOption(countrySelect, passenger.country || "India") : false;

    let preferenceSelect =
      root.querySelector("select[formcontrolname='passengerBerthChoice']") ||
      root.querySelector("select[name='passengerBerthChoice']") ||
      root.querySelector("p-dropdown[formcontrolname='passengerBerthChoice']") ||
      root.querySelector("select[formcontrolname='passengerPreference']") ||
      root.querySelector("select[name='passengerPreference']");
    if (!preferenceSelect) preferenceSelect = findSelectByLabel("preference", root) || findSelectByLabel("berth", root) || findSelectByLabel("reservation choice", root);
    const preferenceOk = preferenceSelect ? await selectDropdownOption(preferenceSelect, passenger.preference || "") : false;

    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const getNewPassengerButton = () => {
    const buttons = [
      ...document.querySelectorAll("button.btn-new-passenger"),
      ...document.querySelectorAll("button[title*='New Passenger']"),
      ...document.querySelectorAll("button[aria-label*='New Passenger']"),
      ...document.querySelectorAll("button").filter(b => b.textContent.includes("+ New Passenger") || b.textContent.includes("Add Infant"))
    ];
    return buttons.find(b => b && b.offsetParent !== null) || null;
  };

  const getAddButton = () => {
    const dialog = getDialog();
    const root = dialog || document;
    const buttons = [
      root.querySelector("button.ap-add-btn"),
      root.querySelector("button[title*='Add Passenger']"),
      root.querySelector("button[aria-label*='Add Passenger']"),
      ...root.querySelectorAll("button").filter(
        b => b.textContent.includes("Add Passenger") || b.textContent.includes("Save") || b.textContent.includes("Continue")
      )
    ];
    return buttons.find(b => b && b.offsetParent !== null) || null;
  };

  const openPassengerDialog = async () => {
    if (getDialog()) return true;
    if (hasDirectPassengerForm()) return true;

    const button = getNewPassengerButton();
    if (!button) {
      console.log("New Passenger button not found");
      return false;
    }
    button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    button.click();
    for (let attempt = 0; attempt < 50; attempt++) {
      await wait(50);
      if (getDialog()) return true;
    }
    return false;
  };

  const submitPassenger = async () => {
    if (hasDirectPassengerForm()) return true;

    const button = getAddButton();
    if (!button) {
      console.log("Add/Save button not found");
      return false;
    }
    button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    button.click();
    await wait(800);
    return !getDialog();
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message.action || !["fillPassengers", "selectExistingPassengers"].includes(message.action))
      return true;

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
          console.log(`Processing passenger ${completed + 1}:`, passenger);
          if (!(await openPassengerDialog())) {
            console.log("Failed to open passenger dialog");
            break;
          }
          await wait(500);
          const result = await fillPassenger(passenger);
          console.log(`Fill result for passenger ${completed + 1}:`, result);

          if (!result.nameOk || !result.ageOk || !result.genderOk || !result.countryOk || !result.preferenceOk) {
            const missing = [
              !result.nameOk && "Name",
              !result.ageOk && "Age",
              !result.genderOk && "Gender",
              !result.countryOk && "Country",
              !result.preferenceOk && "Preference"
            ]
              .filter(Boolean)
              .join(", ");
            sendResponse({
              message: `Passenger ${completed + 1} could not be completed. Failed to set: ${missing}. Check DevTools console for details.`
            });
            return;
          }

          if (!(await submitPassenger())) {
            console.log("Failed to submit passenger");
            break;
          }
          completed++;
        }

        sendResponse({
          message:
            completed === passengers.length
              ? `Added and filled ${completed} passenger(s). Review all details before continuing.`
              : `Filled ${completed} of ${passengers.length} passenger(s).`
        });
      } catch (error) {
        console.error("IRCTC Passenger Autofill Error:", error);
        sendResponse({ message: "Could not fill the passenger form. Check DevTools console for errors." });
      }
    })();

    return true;
  });
})();

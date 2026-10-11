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

  const setSelect = (selectEl, wantedValue) => {
    if (!selectEl || wantedValue === undefined || wantedValue === null || wantedValue === "") return false;
    const text = normalize(wantedValue);
    const options = [...selectEl.options || []];
    const match = options.find(option => normalize(option.textContent) === text || normalize(option.value) === text);
    if (!match) return false;
    selectEl.value = match.value;
    selectEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return true;
  };

  const setCheckbox = (element, checked) => {
    if (!element) return false;
    if (element.type !== "checkbox") return false;
    element.checked = checked;
    ["change", "click"].forEach(type =>
      element.dispatchEvent(new Event(type, { bubbles: true, composed: true }))
    );
    return true;
  };

  const findByLabel = (labelText, selector = "input, select") => {
    const labels = [...document.querySelectorAll("label")];
    const label = labels.find(l => normalize(l.textContent).includes(normalize(labelText)));
    if (!label) return null;
    const inputId = label.getAttribute("for");
    if (inputId) return document.querySelector(`#${CSS.escape(inputId)}`) || document.querySelector(`#${inputId}`);
    return label.closest("form, div, td, tr, li")?.querySelector(selector) || null;
  };

  const checkboxByText = text => {
    const label = [...document.querySelectorAll("label")].find(l => normalize(l.textContent).includes(normalize(text)));
    if (!label) return null;
    const id = label.getAttribute("for");
    if (id) return document.getElementById(id) || document.querySelector(`#${CSS.escape(id)}`);
    return label.closest("div, tr, td, li")?.querySelector("input[type='checkbox']") || null;
  };

  const directPassengerForm = () => {
    return document.querySelector(
      "input[placeholder*='Full Name'], input[placeholder*='Govt. ID'], input[placeholder*='Name as per Govt'], input[placeholder*='full name'], input[placeholder*='Name'], input[name*='passengerName']"
    );
  };

  const addPassengerButton = () => {
    return [...document.querySelectorAll("button")].find(button => {
      const text = normalize(button.textContent || "");
      return text.includes("add passenger") || text.includes("add infant") || text.includes("new passenger");
    });
  };

  const directFillPassenger = async passenger => {
    const nameInput =
      document.querySelector("input[placeholder*='Full Name'], input[placeholder*='Govt. ID'], input[placeholder*='Name as per Govt'], input[placeholder*='full name'], input[name*='passengerName']") ||
      findByLabel("Full Name", "input") ||
      findByLabel("Govt. ID", "input") ||
      document.querySelector("input[type='text']");

    const ageInput =
      document.querySelector("input[placeholder*='Age'], input[name*='passengerAge'], input[type='number']") ||
      findByLabel("Age", "input");

    const genderSelect =
      document.querySelector("select[title*='Gender'], select[name*='passengerGender'], select[id*='gender']") ||
      findByLabel("Gender", "select");

    const countrySelect =
      document.querySelector("select[title*='Country'], select[name*='passengerNationality'], select[id*='country']") ||
      findByLabel("Country", "select");

    const preferenceSelect =
      document.querySelector("select[title*='Preference'], select[name*='passengerBerthChoice'], select[id*='preference']") ||
      findByLabel("Preference", "select") ||
      findByLabel("Berth", "select") ||
      findByLabel("Reservation Choice", "select");

    const nameOk = setInput(nameInput, passenger.name);
    const ageOk = setInput(ageInput, passenger.age);
    const genderOk = genderSelect ? setSelect(genderSelect, passenger.gender || "Male") : true;
    const countryOk = countrySelect ? setSelect(countrySelect, passenger.country || "India") : true;
    const preferenceOk = preferenceSelect ? setSelect(preferenceSelect, passenger.preference || "") : true;

    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const directOnPage = () => !!directPassengerForm();

  const dialog = () => [...document.querySelectorAll(".ui-dialog.add-passenger-dialog, .add-passenger-dialog.ui-dialog, .add-passenger-dialog")].find(node => node && node.offsetParent !== null) || null;

  const setDialogInput = (selector, value) => {
    const input = dialog()?.querySelector(selector);
    return setInput(input, value);
  };

  const selectDialogDropdown = async (name, wantedValue) => {
    const field = dialog()?.querySelector(`p-dropdown[formcontrolname="${name}"]`) || dialog()?.querySelector(`select[formcontrolname="${name}"]`);
    if (!field) return false;
    return setSelect(field, wantedValue || "");
  };

  const fillPassengerDialog = async passenger => {
    const root = dialog();
    if (!root) return { nameOk: false, ageOk: false, genderOk: false, countryOk: false, preferenceOk: false };

    const nameOk = setDialogInput("input[formcontrolname='passengerName'], input[name='passengerName'], input[placeholder*='Full Name']", passenger.name);
    const ageOk = setDialogInput("input[formcontrolname='passengerAge'], input[name='passengerAge'], input[type='number']", passenger.age);
    const genderOk = await selectDialogDropdown("passengerGender", passenger.gender || "Male");
    const countryOk = await selectDialogDropdown("passengerNationality", passenger.country || "India");
    const preferenceOk = await selectDialogDropdown("passengerBerthChoice", passenger.preference || "");
    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const clickAddPassenger = async () => {
    const button = addPassengerButton();
    if (!button) return false;
    button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    button.click();
    await wait(900);
    return true;
  };

  const enablePreferenceOptions = () => {
    const autoUpgrade = checkboxByText("auto upgrade") || checkboxByText("consider for auto upgrade");
    if (autoUpgrade) setCheckbox(autoUpgrade, true);
    const confirmBerths = checkboxByText("book only if confirm berths") || checkboxByText("book only if berths are confirmed");
    if (confirmBerths) setCheckbox(confirmBerths, true);
  };

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message.action || !["fillPassengers", "selectExistingPassengers"].includes(message.action)) return true;

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

        if (directOnPage()) {
          for (const passenger of passengers) {
            const result = await directFillPassenger(passenger);
            if (!result.nameOk || !result.ageOk || !result.countryOk) {
              const missing = [!result.nameOk && "Name", !result.ageOk && "Age", !result.countryOk && "Country"].filter(Boolean).join(", ");
              sendResponse({ message: `Passenger ${completed + 1} could not be completed. Failed to set: ${missing}.` });
              return;
            }

            completed++;
            if (completed < passengers.length) {
              const nextStep = await clickAddPassenger();
              if (!nextStep) break;
              await wait(600);
            }
          }

          enablePreferenceOptions();
          sendResponse({
            message: completed === passengers.length ? `Added and filled ${completed} passenger(s). Review all details before continuing.` : `Filled ${completed} of ${passengers.length} passenger(s).`
          });
          return;
        }

        if (!dialog()) {
          sendResponse({ message: "Open the IRCTC passenger add form and retry." });
          return;
        }

        for (const passenger of passengers) {
          const result = await fillPassengerDialog(passenger);
          if (!result.nameOk || !result.ageOk || !result.genderOk || !result.countryOk || !result.preferenceOk) {
            const missing = [!result.nameOk && "Name", !result.ageOk && "Age", !result.genderOk && "Gender", !result.countryOk && "Country", !result.preferenceOk && "Preference"].filter(Boolean).join(", ");
            sendResponse({ message: `Passenger ${completed + 1} could not be completed. Failed to set: ${missing}.` });
            return;
          }

          const addButton = dialog()?.querySelector("button.ap-add-btn, button[title*='Add Passenger'], button[aria-label*='Add Passenger']") || document.querySelector("button.ap-add-btn");
          if (addButton) {
            addButton.click();
            await wait(900);
          }
          completed++;
        }

        enablePreferenceOptions();
        sendResponse({
          message: completed === passengers.length ? `Added and filled ${completed} passenger(s). Review all details before continuing.` : `Filled ${completed} of ${passengers.length} passenger(s).`
        });
      } catch (error) {
        console.error("IRCTC Passenger Autofill Error:", error);
        sendResponse({ message: "Could not fill the passenger form. Check DevTools console for errors." });
      }
    })();

    return true;
  });
})();

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

  const getPassengerNameInput = () => {
    return (
      document.querySelector("input[placeholder*='Full Name'], input[placeholder*='Govt. ID'], input[placeholder*='Name as per Govt'], input[placeholder*='full name'], input[placeholder*='Name'], input[name*='passengerName'], input[id*='name']") ||
      findByLabel("Full Name", "input") ||
      findByLabel("Govt. ID", "input") ||
      findByLabel("Name as per", "input")
    );
  };

  const getPassengerAgeInput = () => {
    return (
      document.querySelector("input[placeholder*='Age'], input[name*='passengerAge'], input[id*='age']") ||
      findByLabel("Age", "input") ||
      document.querySelector("input[type='number']")
    );
  };

  const getGenderSelect = () => {
    return (
      document.querySelector("select[title*='Gender'], select[name*='passengerGender'], select[id*='gender']") ||
      findByLabel("Gender", "select")
    );
  };

  const getCountrySelect = () => {
    return (
      document.querySelector("select[title*='Country'], select[name*='passengerNationality'], select[id*='country']") ||
      findByLabel("Country", "select")
    );
  };

  const getPreferenceSelect = () => {
    return (
      document.querySelector("select[title*='Preference'], select[name*='passengerBerthChoice'], select[id*='preference']") ||
      findByLabel("Preference", "select") ||
      findByLabel("Berth", "select") ||
      findByLabel("Reservation Choice", "select")
    );
  };

  const getAddPassengerButton = () => {
    return [...document.querySelectorAll("button, a[role='button'], span[role='button']")].find(btn => {
      const text = normalize(btn.textContent || btn.innerText || "");
      return (
        text.includes("add passenger") ||
        text.includes("add infant") ||
        text.includes("new passenger") ||
        text.includes("add infant with berth") ||
        text.includes("add infant without berth")
      );
    });
  };

  const fillPassengerForm = async passenger => {
    const nameInput = getPassengerNameInput();
    const ageInput = getPassengerAgeInput();
    const genderSelect = getGenderSelect();
    const countrySelect = getCountrySelect();
    const preferenceSelect = getPreferenceSelect();

    const nameOk = setInput(nameInput, passenger.name);
    await wait(50);
    const ageOk = setInput(ageInput, passenger.age);
    await wait(50);
    const genderOk = genderSelect ? setSelect(genderSelect, passenger.gender || "Male") : true;
    await wait(50);
    const countryOk = countrySelect ? setSelect(countrySelect, passenger.country || "India") : true;
    await wait(50);
    const preferenceOk = preferenceSelect ? setSelect(preferenceSelect, passenger.preference || "") : true;

    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const clickAddPassengerButton = async () => {
    const button = getAddPassengerButton();
    if (!button) {
      console.log("Add Passenger button not found");
      return false;
    }
    console.log("Clicking Add Passenger button:", button.textContent.trim());
    button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    button.click();
    await wait(1200);
    return true;
  };

  const enablePreferenceCheckboxes = () => {
    const autoUpgrade = checkboxByText("auto upgrade") || checkboxByText("consider for auto upgrade");
    if (autoUpgrade) {
      setCheckbox(autoUpgrade, true);
      console.log("✓ Enabled: Auto Upgrade checkbox");
    }
    const confirmBerths = checkboxByText("book only if confirm berths") || checkboxByText("book only if berths are confirmed");
    if (confirmBerths) {
      setCheckbox(confirmBerths, true);
      console.log("✓ Enabled: Book only if confirm berths checkbox");
    }
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

        console.log(`Starting autofill for ${passengers.length} passengers`);
        let completed = 0;

        for (let i = 0; i < passengers.length; i++) {
          const passenger = passengers[i];
          console.log(`\n--- Processing passenger ${i + 1} / ${passengers.length} ---`);
          console.log("Passenger data:", passenger);

          const result = await fillPassengerForm(passenger);
          console.log(`Fill result:`, result);

          if (!result.nameOk || !result.ageOk || !result.countryOk) {
            const missing = [
              !result.nameOk && "Name",
              !result.ageOk && "Age",
              !result.countryOk && "Country"
            ]
              .filter(Boolean)
              .join(", ");
            console.error(`Failed to fill passenger ${i + 1}. Missing: ${missing}`);
            sendResponse({
              message: `Passenger ${i + 1} could not be completed. Failed to set: ${missing}. Check DevTools console for details.`
            });
            return;
          }

          completed++;
          console.log(`✓ Passenger ${i + 1} filled successfully`);

          // If not the last passenger, click Add Passenger button
          if (i < passengers.length - 1) {
            console.log("Attempting to add next passenger...");
            const addSuccess = await clickAddPassengerButton();
            if (!addSuccess) {
              console.error("Failed to click Add Passenger button");
              break;
            }
            await wait(400);
          }
        }

        console.log(`\n--- Enabling preference checkboxes ---`);
        enablePreferenceCheckboxes();

        console.log(`\n--- Autofill complete ---`);
        sendResponse({
          message:
            completed === passengers.length
              ? `✓ Added and filled ${completed} passenger(s). Review all details before continuing.`
              : `⚠ Filled ${completed} of ${passengers.length} passenger(s).`
        });
      } catch (error) {
        console.error("IRCTC Passenger Autofill Error:", error);
        sendResponse({
          message: "Could not fill the passenger form. Check DevTools console for errors."
        });
      }
    })();

    return true;
  });
})();

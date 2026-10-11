(() => {
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const normalize = value => String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
  const visible = element => {
    if (!element) return false;
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse";
  };

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

    const wanted = normalize(wantedValue);
    const options = [...(selectEl.options || [])];
    if (!options.length) return false;

    for (const option of options) {
      const text = normalize(option.textContent);
      const val = normalize(option.value);
      if (text === wanted || val === wanted || text.includes(wanted) || val.includes(wanted)) {
        selectEl.value = option.value;
        selectEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
        selectEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
        return true;
      }
    }

    const fallbackMap = {
      "no preference": 0,
      lower: 1,
      middle: 2,
      upper: 3,
      "side lower": 4,
      "side upper": 5,
      male: 1,
      female: 2,
      transgender: 3,
      india: 1
    };

    const index = fallbackMap[wanted];
    if (index !== undefined && options[index]) {
      selectEl.value = options[index].value;
      selectEl.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
      selectEl.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
      return true;
    }

    return false;
  };

  const getPassengerRows = () => {
    const rows = [...document.querySelectorAll("div, section, fieldset")].filter(node => {
      if (!node || !visible(node)) return false;
      const text = normalize(node.textContent || "");
      const hasName = !!node.querySelector("input[placeholder*='Full Name'], input[placeholder*='Govt. ID'], input[placeholder*='Name as per']");
      const hasAge = !!node.querySelector("input[type='number']");
      const hasGenderCountry = !!node.querySelector("select");
      return (text.includes("passenger") || hasName || hasAge || hasGenderCountry) && (hasName || hasAge || hasGenderCountry);
    });

    return rows.filter(node => {
      const innerText = normalize(node.textContent || "");
      return innerText.includes("full name") || innerText.includes("age") || innerText.includes("gender") || innerText.includes("country") || innerText.includes("berth preference");
    });
  };

  const fillPassengerSection = async (section, passenger) => {
    if (!section) return { nameOk: false, ageOk: false, genderOk: false, countryOk: false, preferenceOk: false };

    const nameInput =
      section.querySelector("input[placeholder*='Full Name'], input[placeholder*='Govt. ID'], input[placeholder*='Name as per'], input[name*='passengerName'], input[id*='name']") ||
      section.querySelector("input[type='text']") ||
      section.querySelector("input");

    const ageInput =
      section.querySelector("input[placeholder*='Age'], input[name*='passengerAge'], input[id*='age'], input[type='number']") ||
      section.querySelector("input[type='number']");

    const genderSelect =
      section.querySelector("select[title*='Gender'], select[name*='passengerGender'], select[id*='gender']") ||
      [...section.querySelectorAll("select")].find(s => {
        const text = normalize(s.textContent || "");
        return text.includes("male") || text.includes("female") || text.includes("transgender");
      });

    const countrySelect =
      section.querySelector("select[title*='Country'], select[name*='passengerNationality'], select[id*='country']") ||
      [...section.querySelectorAll("select")].find(s => {
        const text = normalize(s.textContent || "");
        return text.includes("india") || text.includes("country");
      });

    const preferenceSelect =
      section.querySelector("select[title*='Preference'], select[name*='passengerBerthChoice'], select[id*='preference'], select[title*='Berth']") ||
      [...section.querySelectorAll("select")].find(s => {
        const text = normalize(s.textContent || "");
        return text.includes("no preference") || text.includes("lower") || text.includes("middle") || text.includes("upper") || text.includes("side lower") || text.includes("side upper");
      });

    const nameOk = setInput(nameInput, passenger.name);
    const ageOk = setInput(ageInput, passenger.age);
    const genderOk = genderSelect ? setSelect(genderSelect, passenger.gender || "Male") : true;
    const countryOk = countrySelect ? setSelect(countrySelect, passenger.country || "India") : true;
    const preferenceOk = preferenceSelect ? setSelect(preferenceSelect, passenger.preference || "No Preference") : true;

    return { nameOk, ageOk, genderOk, countryOk, preferenceOk };
  };

  const getAddPassengerButton = () => {
    const buttons = [...document.querySelectorAll("button, a[role='button'], span[role='button']")].filter(btn => {
      const text = normalize(btn.textContent || btn.innerText || "");
      return (
        text.includes("add passenger") ||
        text.includes("add infant") ||
        text.includes("new passenger") ||
        text.includes("add infant with berth") ||
        text.includes("add infant without berth")
      );
    });

    return buttons.find(visible) || buttons[buttons.length - 1] || null;
  };

  const clickAddPassengerButton = async () => {
    const btn = getAddPassengerButton();
    if (!btn) return false;
    btn.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    btn.click();
    await wait(800);
    return true;
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

        for (let i = 0; i < passengers.length; i++) {
          await wait(250);
          const passengerRows = getPassengerRows();
          const section = passengerRows[Math.min(i, passengerRows.length - 1)] || document;
          const result = await fillPassengerSection(section, passengers[i]);

          if (!result.nameOk || !result.ageOk || !result.countryOk) {
            const missing = [!result.nameOk && "Name", !result.ageOk && "Age", !result.countryOk && "Country"]
              .filter(Boolean)
              .join(", ");
            sendResponse({ message: `Passenger ${i + 1} could not be completed. Failed to set: ${missing}.` });
            return;
          }

          completed++;

          if (i < passengers.length - 1) {
            const added = await clickAddPassengerButton();
            if (!added) break;
            await wait(800);
          }
        }

        sendResponse({
          message: completed === passengers.length
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

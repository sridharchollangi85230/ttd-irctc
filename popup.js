const emptyPassenger = () => ({ name: "", age: "", gender: "Male", country: "India", preference: "" });
const defaultData = { profiles: [{ id: crypto.randomUUID(), name: "Family passengers", passengers: [emptyPassenger()] }], selected: null, preferences: { autoUpgrade: false, confirmedBerths: false } };
let data;

const current = () => data.profiles.find(profile => profile.id === data.selected) || data.profiles[0];
const status = message => { document.getElementById("status").textContent = message; };
const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

function migrateProfile(profile) {
  if (!Array.isArray(profile.passengers)) profile.passengers = [profile.passenger || emptyPassenger()];
  profile.passengers = profile.passengers.map(passenger => ({ ...emptyPassenger(), ...passenger }));
  delete profile.passenger;
  return profile;
}

async function load() {
  data = await chrome.storage.local.get(defaultData);
  if (!data.profiles?.length) data.profiles = defaultData.profiles;
  data.profiles = data.profiles.map(migrateProfile);
  data.preferences = { ...defaultData.preferences, ...(data.preferences || {}) };
  if (!data.selected || !data.profiles.some(profile => profile.id === data.selected)) data.selected = data.profiles[0].id;
  document.getElementById("autoUpgrade").checked = data.preferences.autoUpgrade;
  document.getElementById("confirmedBerths").checked = data.preferences.confirmedBerths;
  renderProfiles();
  renderEditor();
}

function renderProfiles() {
  const select = document.getElementById("profileSelect");
  select.replaceChildren();
  data.profiles.forEach(profile => select.add(new Option(profile.name, profile.id, profile.id === data.selected, profile.id === data.selected)));
}

function renderEditor() {
  const profile = current();
  document.getElementById("profileName").value = profile.name || "";
  const root = document.getElementById("passengers");
  root.replaceChildren();
  profile.passengers.forEach((passenger, index) => {
    const box = document.createElement("div");
    box.className = "passenger";
    box.innerHTML = `<h4>Passenger ${index + 1}</h4>
      <label>Full Name as per Govt. ID</label><input data-key="name" data-index="${index}" value="${escapeHtml(passenger.name)}">
      <label>Age</label><input data-key="age" data-index="${index}" value="${escapeHtml(passenger.age)}" type="number" min="1" max="120" inputmode="numeric">
      <label>Gender</label><select data-key="gender" data-index="${index}"><option>Male</option><option>Female</option><option>Transgender</option></select>
      <label>Country</label><input data-key="country" data-index="${index}" value="${escapeHtml(passenger.country || "India")}">
      <label>Preference</label><select data-key="preference" data-index="${index}"><option value="">Select</option><option>Lower</option><option>Middle</option><option>Upper</option><option>Side Lower</option><option>Side Upper</option></select>
      <button class="remove" data-remove="${index}">Remove Passenger</button>`;
    root.append(box);
    box.querySelector('[data-key="gender"]').value = passenger.gender || "Male";
    box.querySelector('[data-key="preference"]').value = passenger.preference || "";
  });
}

function readEditor() {
  const profile = current();
  profile.name = document.getElementById("profileName").value.trim() || "Family passengers";
  document.querySelectorAll("#passengers [data-key]").forEach(element => {
    profile.passengers[Number(element.dataset.index)][element.dataset.key] = element.value;
  });
  data.preferences = {
    autoUpgrade: document.getElementById("autoUpgrade").checked,
    confirmedBerths: document.getElementById("confirmedBerths").checked
  };
}

async function save() {
  readEditor();
  await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected, preferences: data.preferences });
  renderProfiles();
}

async function send(action) {
  await save();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return status("No active tab.");
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, passengers: current().passengers, preferences: data.preferences });
    status(response?.message || "Completed. Review all passenger details.");
  } catch (error) {
    console.error(error);
    status("Open the IRCTC passenger page and reload it, then try again.");
  }
}

document.getElementById("profileSelect").addEventListener("change", async event => {
  readEditor();
  data.selected = event.target.value;
  await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected, preferences: data.preferences });
  renderEditor();
});
document.getElementById("saveBtn").addEventListener("click", async () => { await save(); status("Profile saved locally."); });
document.getElementById("fillAllBtn").addEventListener("click", () => send("fillPassengers"));
document.getElementById("existingPassengerBtn").addEventListener("click", () => send("selectExistingPassengers"));
document.getElementById("autoUpgrade").addEventListener("change", save);
document.getElementById("confirmedBerths").addEventListener("change", save);
document.getElementById("addPassengerBtn").addEventListener("click", () => { readEditor(); current().passengers.push(emptyPassenger()); renderEditor(); });
document.getElementById("newBtn").addEventListener("click", async () => {
  readEditor();
  const profile = { id: crypto.randomUUID(), name: `Profile ${data.profiles.length + 1}`, passengers: [emptyPassenger()] };
  data.profiles.push(profile); data.selected = profile.id;
  await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected, preferences: data.preferences });
  renderProfiles(); renderEditor(); status("New profile created.");
});
document.getElementById("passengers").addEventListener("click", event => {
  const index = event.target.dataset.remove;
  if (index === undefined) return;
  readEditor();
  if (current().passengers.length === 1) return status("Keep at least one passenger.");
  current().passengers.splice(Number(index), 1);
  renderEditor();
});

load().catch(error => { console.error(error); status("Could not load local profiles."); });

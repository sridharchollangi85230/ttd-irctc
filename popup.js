const emptyPassenger = () => ({ name: "", age: "", gender: "Male", country: "India", preference: "" });
const defaultData = { profiles: [{ id: crypto.randomUUID(), name: "Family passengers", passengers: [emptyPassenger()] }], selected: null, preferences: { autoUpgrade: false, confirmedBerths: false } };
let data;
const current = () => data.profiles.find(p => p.id === data.selected) || data.profiles[0];
const status = message => { document.getElementById("status").textContent = message; };
const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
function migrate(p) { if (!Array.isArray(p.passengers)) p.passengers = [p.passenger || emptyPassenger()]; p.passengers = p.passengers.map(x => ({ ...emptyPassenger(), ...x })); delete p.passenger; return p; }
async function load() {
  data = await chrome.storage.local.get(defaultData);
  data.profiles = (data.profiles?.length ? data.profiles : defaultData.profiles).map(migrate);
  data.preferences = { ...defaultData.preferences, ...(data.preferences || {}) };
  if (!data.selected || !data.profiles.some(p => p.id === data.selected)) data.selected = data.profiles[0].id;
  document.getElementById("autoUpgrade").checked = data.preferences.autoUpgrade;
  document.getElementById("confirmedBerths").checked = data.preferences.confirmedBerths;
  renderProfiles(); renderEditor();
}
function renderProfiles() { const select = document.getElementById("profileSelect"); select.replaceChildren(); data.profiles.forEach(p => select.add(new Option(p.name, p.id, p.id === data.selected, p.id === data.selected))); }
function renderEditor() {
  const p = current(); document.getElementById("profileName").value = p.name || ""; const root = document.getElementById("passengers"); root.replaceChildren();
  p.passengers.forEach((x, i) => { const box = document.createElement("div"); box.className = "passenger"; box.innerHTML = `<h4>Passenger ${i + 1}</h4><label>Full Name as per Govt. ID</label><input data-key="name" data-index="${i}" value="${escapeHtml(x.name)}"><label>Age</label><input data-key="age" data-index="${i}" value="${escapeHtml(x.age)}" type="number" min="1" max="120"><label>Gender</label><select data-key="gender" data-index="${i}"><option>Male</option><option>Female</option><option>Transgender</option></select><label>Country</label><input data-key="country" data-index="${i}" value="${escapeHtml(x.country || "India")}"><label>Preference</label><select data-key="preference" data-index="${i}"><option value="">Select</option><option>Lower</option><option>Middle</option><option>Upper</option><option>Side Lower</option><option>Side Upper</option></select><button class="remove" data-remove="${i}">Remove Passenger</button>`; root.append(box); box.querySelector('[data-key="gender"]').value = x.gender || "Male"; box.querySelector('[data-key="preference"]').value = x.preference || ""; });
}
function readEditor() { const p = current(); p.name = document.getElementById("profileName").value.trim() || "Family passengers"; document.querySelectorAll("#passengers [data-key]").forEach(e => p.passengers[+e.dataset.index][e.dataset.key] = e.value); data.preferences = { autoUpgrade: document.getElementById("autoUpgrade").checked, confirmedBerths: document.getElementById("confirmedBerths").checked }; }
async function save() { readEditor(); await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected, preferences: data.preferences }); renderProfiles(); }
async function send(action) { await save(); const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); if (!tab?.id) return status("No active tab."); try { const r = await chrome.tabs.sendMessage(tab.id, { action, passengers: current().passengers, preferences: data.preferences }); status(r?.message || "Completed. Review all details."); } catch (e) { console.error(e); status("Open the IRCTC passenger page and reload it, then try again."); } }
document.getElementById("profileSelect").addEventListener("change", async e => { readEditor(); data.selected = e.target.value; await save(); renderEditor(); });
document.getElementById("saveBtn").addEventListener("click", async () => { await save(); status("Profile saved locally."); });
document.getElementById("fillAllBtn").addEventListener("click", () => send("fillPassengers"));
document.getElementById("existingPassengerBtn").addEventListener("click", () => send("selectExistingPassengers"));
document.getElementById("autoUpgrade").addEventListener("change", save); document.getElementById("confirmedBerths").addEventListener("change", save);
document.getElementById("addPassengerBtn").addEventListener("click", () => { readEditor(); current().passengers.push(emptyPassenger()); renderEditor(); });
document.getElementById("newBtn").addEventListener("click", async () => { readEditor(); const p = { id: crypto.randomUUID(), name: `Profile ${data.profiles.length + 1}`, passengers: [emptyPassenger()] }; data.profiles.push(p); data.selected = p.id; await save(); renderEditor(); status("New profile created."); });
document.getElementById("passengers").addEventListener("click", e => { const i = e.target.dataset.remove; if (i === undefined) return; readEditor(); if (current().passengers.length === 1) return status("Keep at least one passenger."); current().passengers.splice(+i, 1); renderEditor(); });
load().catch(e => { console.error(e); status("Could not load local profiles."); });

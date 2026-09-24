const emptyPilgrim = () => ({ name: "", age: "", gender: "Male", idType: "Aadhaar Card", idNumber: "" });
const emptyGeneralDetails = () => ({ email: "", city: "", state: "", country: "", pincode: "" });
const defaultData = { profiles: [{ id: crypto.randomUUID(), name: "My Profile", generalDetails: emptyGeneralDetails(), pilgrims: [emptyPilgrim()] }], selected: null };
let data;

const current = () => data.profiles.find(profile => profile.id === data.selected) || data.profiles[0];
const status = message => { document.getElementById("status").textContent = message; };
const escapeHtml = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");

async function load() {
  data = await chrome.storage.local.get(defaultData);
  if (!data.profiles?.length) data.profiles = defaultData.profiles;
  data.profiles.forEach(profile => {
    if (!profile.generalDetails) profile.generalDetails = emptyGeneralDetails();
    if (!profile.pilgrims?.length) profile.pilgrims = [emptyPilgrim()];
  });
  if (!data.selected || !data.profiles.some(profile => profile.id === data.selected)) data.selected = data.profiles[0].id;
  renderProfiles();
  renderEditor();
}

function renderProfiles() {
  const select = document.getElementById("profileSelect");
  select.replaceChildren();
  data.profiles.forEach(profile => {
    const option = new Option(profile.name, profile.id, profile.id === data.selected, profile.id === data.selected);
    select.add(option);
  });
}

function renderEditor() {
  const profile = current();
  document.getElementById("profileName").value = profile.name;
  document.getElementById("generalEmail").value = profile.generalDetails?.email || "";
  document.getElementById("generalCity").value = profile.generalDetails?.city || "";
  document.getElementById("generalState").value = profile.generalDetails?.state || "";
  document.getElementById("generalCountry").value = profile.generalDetails?.country || "";
  document.getElementById("generalPincode").value = profile.generalDetails?.pincode || "";

  const root = document.getElementById("pilgrims");
  root.replaceChildren();
  profile.pilgrims.forEach((pilgrim, index) => {
    const box = document.createElement("div");
    box.className = "pilgrim";
    box.innerHTML = `<h4>Pilgrim ${index + 1}</h4>
      <label>Name</label><input data-key="name" data-index="${index}" value="${escapeHtml(pilgrim.name)}">
      <label>Age</label><input data-key="age" data-index="${index}" value="${escapeHtml(pilgrim.age)}" inputmode="numeric">
      <label>Gender</label><select data-key="gender" data-index="${index}"><option>Male</option><option>Female</option><option>Other</option></select>
      <label>Photo ID Proof</label><input data-key="idType" data-index="${index}" value="${escapeHtml(pilgrim.idType)}">
      <label>Photo ID Number</label><input data-key="idNumber" data-index="${index}" value="${escapeHtml(pilgrim.idNumber)}">
      <button class="remove" data-remove="${index}">Remove Pilgrim</button>`;
    root.append(box);
    box.querySelector('[data-key="gender"]').value = pilgrim.gender || "Male";
  });
}

function readEditor() {
  const profile = current();
  profile.name = document.getElementById("profileName").value.trim() || "My Profile";
  profile.generalDetails = {
    email: document.getElementById("generalEmail").value.trim(),
    city: document.getElementById("generalCity").value.trim(),
    state: document.getElementById("generalState").value.trim(),
    country: document.getElementById("generalCountry").value.trim(),
    pincode: document.getElementById("generalPincode").value.trim()
  };
  document.querySelectorAll("#pilgrims [data-key]").forEach(element => {
    profile.pilgrims[Number(element.dataset.index)][element.dataset.key] = element.value;
  });
}

async function save() {
  readEditor();
  await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected });
  renderProfiles();
}

document.getElementById("profileSelect").addEventListener("change", async event => {
  readEditor();
  data.selected = event.target.value;
  await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected });
  renderEditor();
});
document.getElementById("saveBtn").addEventListener("click", async () => { await save(); status("Profile saved locally."); });
document.getElementById("newBtn").addEventListener("click", async () => {
  readEditor();
  const profile = { id: crypto.randomUUID(), name: `Profile ${data.profiles.length + 1}`, generalDetails: emptyGeneralDetails(), pilgrims: [emptyPilgrim()] };
  data.profiles.push(profile); data.selected = profile.id;
  await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected });
  renderProfiles(); renderEditor(); status("New profile created.");
});
document.getElementById("addPilgrimBtn").addEventListener("click", () => { readEditor(); current().pilgrims.push(emptyPilgrim()); renderEditor(); });
document.getElementById("deleteBtn").addEventListener("click", async () => {
  if (data.profiles.length === 1) return status("Keep at least one profile.");
  data.profiles = data.profiles.filter(profile => profile.id !== data.selected);
  data.selected = data.profiles[0].id;
  await chrome.storage.local.set({ profiles: data.profiles, selected: data.selected });
  renderProfiles(); renderEditor(); status("Profile deleted.");
});
document.getElementById("pilgrims").addEventListener("click", event => {
  const index = event.target.dataset.remove;
  if (index === undefined) return;
  readEditor(); current().pilgrims.splice(Number(index), 1);
  if (!current().pilgrims.length) current().pilgrims.push(emptyPilgrim());
  renderEditor();
});
document.getElementById("fillBtn").addEventListener("click", async () => {
  await save();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return status("No active tab.");
  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "fill", profile: current() });
    status(response?.message || "Fill completed.");
  } catch (error) {
    console.error(error);
    status("Open the TTD booking page and reload it, then try again.");
  }
});

load().catch(error => { console.error(error); status("Could not load local profiles."); });

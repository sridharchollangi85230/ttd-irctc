# IRCTC Passenger Autofill

A Chrome/Edge Manifest V3 extension for filling multiple IRCTC passenger dialogs one after another, with automatic booking preference selection.

## Features

- **Local-only storage**: All profiles saved in browser storage, no cloud sync.
- **Multiple passengers**: Add and fill multiple passengers in a single action.
- **Booking preferences**: Automatically select:
  - Consider for Auto Upgradation
  - Book only if confirm berths are allotted
- **Passenger details**: Store name, age, gender, country, and berth preference.
- **Profile management**: Create, edit, save, and delete passenger profiles.

## How to Use

### Setup

1. Download or clone this repository.
2. Open Chrome or Edge.
3. Go to `chrome://extensions/` or `edge://extensions/`.
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked**.
6. Select this folder.

### Adding Passengers

1. Open the extension popup.
2. Enter a profile name (e.g., "Family passengers").
3. Click **+ Add Passenger**.
4. Fill in the passenger details:
   - Full Name as per Government ID
   - Age
   - Gender
   - Country
   - Berth Preference (Lower, Middle, Upper, etc.)
5. Click **Save Profile**.

### Selecting Preferences

1. Open the **Other Preferences** section.
2. Check the options:
   - **Consider for Auto Upgradation** – Select if you want upgrade options.
   - **Book only if confirm berths are allotted** – Select to book only with confirmed seats.
3. Click **Save Profile**.

### Filling the IRCTC Booking Form

1. Navigate to the IRCTC passenger booking page.
2. Reload the page (important).
3. Open the extension popup.
4. Select your passenger profile.
5. Click **Add & Fill All Passengers**.

### What the Extension Does

1. Selects your booking preferences (Auto Upgradation, Confirm Berths Only).
2. Opens the "**+ New Passenger**" dialog.
3. Fills in passenger details (name, age, gender, country, preference).
4. Clicks **Add Passenger/Save Passenger**.
5. Waits for the dialog to close.
6. Repeats for the next passenger.

### What It Does NOT Do

- Does not automate CAPTCHA verification.
- Does not automate payment entry.
- Does not handle quota selection or seat availability.
- Does not automate final booking submission.
- **You must review all passenger details and preferences manually before continuing.**

## Troubleshooting

### "No active tab" error

- The extension popup must be open on the IRCTC booking page.
- Reload the page and try again.

### Passenger dialog does not open

- The IRCTC page layout may have changed.
- Click **+ New Passenger** manually first.
- Then try the extension again.

### Fields not filling

- Different IRCTC pages may have different field names or structures.
- Manually verify the field `formcontrolname` attributes using DevTools.
- Update `content.js` selectors if needed.

### Preference checkboxes not selected

- IRCTC may use custom checkbox components.
- Manually select the checkboxes if the extension cannot find them.
- The extension logs to console; check for error messages in DevTools.

## File Structure

```
.
├── manifest.json       # Extension configuration
├── content.js          # IRCTC page form filling logic
├── popup.html          # Extension popup UI
├── popup.js            # Popup state management
├── popup.css           # Popup styling
└── README.md          # This file
```

## Requirements

- Chrome 88+ or Edge 88+
- IRCTC booking page at `https://www.irctc.co.in/` or `https://irctc.co.in/`

## License

Open source. Modify and distribute as needed.

## Disclaimer

This extension is for personal use only. IRCTC's terms of service may prohibit automation of their booking system. Use at your own risk. The author is not responsible for any account suspension or violation of IRCTC policies.

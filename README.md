# IRCTC Passenger Autofill

A Chrome/Edge Manifest V3 extension for automating IRCTC passenger form filling with improved compatibility.

## Features

- 💾 **Local Storage**: Save multiple passenger profiles locally (no cloud sync)
- 🤖 **Auto-Fill**: Automatically fill passenger dialogs one by one
- 🔄 **Multiple Passengers**: Add as many passengers as needed to a profile
- 🛡️ **Privacy**: All data stored locally, no external requests

## Installation

1. Clone or download this repository
2. Open Chrome/Edge and go to `chrome://extensions/` or `edge://extensions/`
3. Enable **Developer mode** (toggle in the top right)
4. Click **Load unpacked**
5. Select this repository folder

## Usage

### Setting up a profile:

1. Click the extension icon in your browser toolbar
2. Add passenger names, ages, genders, nationalities, and berth preferences
3. Click **Save Profile** to store locally
4. Create multiple profiles for different groups

### Filling the IRCTC form:

1. Go to [IRCTC.co.in](https://www.irctc.co.in) and navigate to the passenger entry page
2. Click the extension icon
3. Select the profile with your passengers
4. Click **Add & Fill All Passengers**
5. The extension will:
   - Click "+ New Passenger"
   - Fill in Name, Age, Gender, Nationality, and Berth Preference
   - Click "Add Passenger"
   - Repeat for the next passenger
6. **Review all passenger details** before proceeding
7. **Manually handle** CAPTCHA, quota selection, payment, and final booking

## Limitations

⚠️ This extension **does NOT automate**:
- CAPTCHA challenges
- Payment processing
- Quota/Class selection
- Queue handling
- Final booking submission

You must complete these steps manually.

## Troubleshooting

### Auto-fill is not working:

1. Ensure you're on the IRCTC passenger entry page
2. Open the IRCTC page in a new tab and reload it completely
3. Make sure the passenger form is fully loaded before clicking the extension button
4. Right-click the extension icon → "Inspect" and check the **Console** for errors
5. If DOM selectors have changed, you may need to update the extension

### Check the Console for debugging:

1. Open Developer Tools (`F12`)
2. Go to the **Console** tab
3. Look for messages prefixed with "IRCTC Passenger Autofill"
4. These will help identify what's failing

## Technical Details

### What the extension does:

- Intercepts messages from the popup UI
- Finds the passenger dialog on the IRCTC page
- Locates form fields by multiple selector strategies (class names, attributes, labels)
- Fills inputs and selects options from dropdowns
- Clicks buttons to add passengers
- Waits for form state changes before proceeding

### Compatibility:

- Works with Manifest V3 (Chrome 88+, Edge 88+)
- Targets IRCTC's current DOM structure
- If IRCTC changes the HTML markup, the extension may need updates

## File Structure

```
.
├── manifest.json      # Extension configuration
├── content.js         # Script that runs on IRCTC website
├── popup.html         # Extension UI
├── popup.js           # Popup logic and storage
├── popup.css          # Popup styling
└── README.md          # This file
```

## License

MIT License - Use at your own risk. IRCTC is a registered trademark of Indian Railways.

## Disclaimer

This extension is an unofficial tool and is not affiliated with Indian Railways or IRCTC. Use it responsibly and always review auto-filled information before submission. The authors are not responsible for any booking errors or issues that may arise from using this tool.

# IRCTC Passenger Autofill

A Microsoft Edge Manifest V3 extension for filling multiple IRCTC passenger dialogs one after another.

## Multiple passengers

1. Add each person to the profile with **+ Add Passenger**.
2. Click **Add & Fill All Passengers**.
3. The extension clicks **+ New Passenger**, fills one passenger, clicks the modal's **Add Passenger/Save Passenger** action, waits for the passenger to be added, and repeats for the next person.
4. Review every passenger manually before continuing.

The extension does not automate CAPTCHA, payment, quota selection, queue handling, or final booking submission. If IRCTC changes the modal button text or layout, complete that step manually.

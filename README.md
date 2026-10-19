# Member Count & Day Amount Tracker

A modern web application to track member counts and daily amount additions with **Full Day** and **Half Day** options.

---

## 🚀 How to Run

- **Desktop Launcher**: Double-click [**`start.bat`**](start.bat) to launch the app at [http://localhost:3000](http://localhost:3000).
- **Direct Browser File**: You can also open [**`index.html`**](index.html) directly in any browser.

---

## 💵 How Full Day & Half Day Work

| Status | Count Added | Amount Added (Example) | Description |
| :--- | :---: | :---: | :--- |
| **🟢 Full Day** | **+1.0 Day** | **+₹350** | Full day attendance and full day amount added |
| **🟡 Half Day** | **+0.5 Day** | **+₹150** | Half day attendance and half day amount added |
| **⚪ Absent** | **0** | **₹0** | Not present |

- **Fixed Rate (Not everyday edit)**: The standard rate stays constant every day (`Day: ₹100 • Half: ₹50`). You don't have to edit or re-enter it every day!
- **Owner: Change Amount Button**: When the owner wants to adjust standard rates, click **`Owner: Change Amount`** to open the settings popup and update the rates anytime.
- **Daily Calculation**:
  $$\text{Total Headcount} = \text{Full Days} + (0.5 \times \text{Half Days})$$
  $$\text{Total Day Amount} = (\text{Full Days} \times \text{Day Amount}) + (\text{Half Days} \times \text{Half Day Amount})$$

---

## ✨ Features Included

1. **Daily Entry**:
   - **Member Names Mode**: 3 clickable buttons on every member card: `Full Day`, `Half Day`, `Absent`.
   - **Quick Batch Buttons**: Mark `All Full Day`, `All Half Day`, or `Clear All` in one click.
   - **Quick Headcount Mode**: Increment Full Day and Half Day counters with `+` and `-` buttons.
   - **Date Navigator**: Quickly switch between days or pick any calendar date.

2. **Monthly Breakdown & Totals (Mound Total)**:
   - Date-by-date breakdown showing: Full Days, Half Days, Total Days, and Total Amount Added.
   - Monthly summary cards for Total Full Days, Half Days, and Total Month Amount.
   - Interactive trend chart.
   - **Export CSV**: One-click download of the complete monthly report for Excel.

3. **Member Monthly Slips**:
   - View itemized monthly slips for each member with dates and (Full Day / Half Day) status.
   - Print or Save as PDF.

4. **Database File**:
   - Stored in [**`database.json`**](database.json) right inside your project directory.


4. **Database File**:
   - Stored in [**`database.json`**](database.json) right inside your project directory.

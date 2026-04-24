# Renachem Pharmacy POS - Installation & System Requirements

This guide details how to set up the Renachem Pharmacy POS on a client machine.

---

## 1. System Requirements

### **Supported Operating Systems**
The system is built on Electron and is optimized for the following:
*   **Windows (Recommended)**: Windows 10 or Windows 11 (64-bit).
*   **Linux**: Ubuntu 20.04+, Debian, or Fedora.
*   **macOS**: macOS 11.0 (Big Sur) or newer.

### **Hardware Requirements**
*   **Processor**: 2.0 GHz Dual-Core or faster.
*   **RAM**: 4GB Minimum (8GB Recommended for smoother multitasking).
*   **Storage**: 500MB free space for the application, plus additional space for database growth and daily backups.
*   **Display**: Minimum 1366x768 resolution (optimized for 1920x1080).

---

## 2. Prerequisites

### **Hardware Peripherals**
1.  **Thermal Printer**: 80mm or 58mm Thermal Printer (drivers must be installed in Windows).
2.  **Barcode Scanner**: Any standard USB or Wireless scanner (Plug-and-Play).

### **Software (For Developer/Source Install)**
If you are installing from source code:
*   **Node.js**: Version 18.x or 20.x (LTS).
*   **Git**: To clone the repository.

---

## 3. Installation Steps

### **Option A: Using the Executable (Standalone)**
1.  Copy the `renachem-pos-win-x64` folder to the client machine (Recommended: `C:\RenachemPOS`).
2.  Right-click `renachem-pos.exe` and select **Send to > Desktop (create shortcut)**.
3.  Double-click the shortcut to launch.
4.  The system will automatically create the `database`, `backups`, and `logs` folders on its first run.

### **Option B: From Source (For Developers)**
1.  Clone the repository: `git clone https://github.com/Nixs012/renachem-pos.git`
2.  Navigate to the folder: `cd renachem-pos`
3.  Install dependencies: `npm install`
4.  Start the app: `npm start` or `npm run dev`

---

## 4. Hardware Configuration

### **Printer Setup**
1.  Install the official driver for your printer.
2.  Go to **Windows Settings > Devices > Printers & Scanners**.
3.  Set your Thermal Printer as the **Default Printer**.
4.  In the POS settings, ensure your Pharmacy Name and Address are set for the receipt header.

### **Barcode Scanner Setup**
1.  Plug the scanner into any USB port.
2.  Open **Notepad** and scan any item to verify text appears.
3.  The POS will now automatically accept scans in the **POS Billing** and **Inventory** tabs.

---

## 5. Maintenance & Safety
*   **Data Location**: All data is stored locally in the `%APPDATA%/renachem-pos` folder. 
*   **Backups**: Ensure the computer is not turned off during the **Daily Backup** (triggered on first launch of the day).
*   **Power**: Use a **UPS (Uninterruptible Power Supply)** for the hosting machine to prevent database corruption during sudden power outages.

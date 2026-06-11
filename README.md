
<div align="center">
  <a name="readme-top"></a>
  <img src="https://raw.githubusercontent.com/beto-group/beto.assets/main/BETO.logo.animated.svg?raw=true" alt="LOGO" width="160">
  <h1 align="center">ESLintVerifier</h1>
  <h3 align="center"> Interactive Obsidian Datacore Component ESLint Checker </h3>
</div>

<div align="center">
  <!-- TOP PURPLE LINKS -->
  <a href="https://beto.group"><img src="https://img.shields.io/badge/WEBSITE-7A46F1?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgY2xhc3M9Imx1Y2lkZSBsdWNpZGUtZXh0ZXJuYWwtbGluayI+PHBhdGggZD0iTTE4IDEzdjZhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJWOGEyIDIgMCAwIDEgMi0yaDYiLz48cG9seWxpbmUgcG9pbnRzPSIxNSAzIDIxIDMgMjEgOSIvPjxsaW5lIHgxPSIxMCIgeDI9IjIxIiB5MT0iMTQiIHkyPSIzIi8+PC9zdmc+" alt="WEBSITE"></a>
  <a href="https://discord.com/invite/6rDp4q4Y2B"><img src="https://img.shields.io/badge/DISCORD-7A46F1?style=for-the-badge&logo=discord&logoColor=white" alt="JOIN OUR DISCORD"></a>
  <a href="https://github.com/sponsors/beto-group"><img src="https://img.shields.io/badge/Sponsor-7A46F1?style=for-the-badge&logo=githubsponsors&logoColor=white" alt="SUPPORT US ON GITHUB"></a>
  <br/>
  <!-- BOTTOM GOLD TAXONOMY -->
  <img src="https://img.shields.io/badge/TARGET-DATACORE-000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkUxNjUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48ZWxsaXBzZSBjeD0iMTIiIGN5PSI1IiByeD0iOSIgcnk9IjMiLz48cGF0aCBkPSJNIDMgNXYxNGE5IDMgMCAwIDAgMTggMHYtMTQiLz48cGF0aCBkPSJNIDMgMTJhOSAzIDAgMCAwIDE4IDAiLz48L3N2Zz4=" alt="TARGET">
  <img src="https://img.shields.io/badge/SECURITY-LOCAL__ACCESS-000?style=for-the-badge&logo=data:image/svg%2Bxml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkUxNjUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cmVjdCB3aWR0aD0iMTgiIGhlaWdodD0iMTEiIHg9IjMiIHk9IjExIiByeD0iMiIgcnk9IjIiLz48cGF0aCBkPSJNNyAxMVY3YTUgNSAwIDAgMSAxMCAwdjQiLz48L3N2Zz4=" alt="SECURITY">
  <img src="https://img.shields.io/badge/RUNTIME-REACT-000?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNGRkUxNjUiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIyIi8+PHBhdGggZD0iTTEyIDJhMTAgMTAgMCAwIDEgMCAyMCIvPjxwYXRoIGQ9Ik0xMiAyYTEwIDEwIDAgMCAwIDAgMjAiLz48L3N2Zz4=" alt="RUNTIME">
  <hr>
</div>

<div align="center">
  <img src="assets/eslintverifier.clip.gif" alt="ESLint Verifier Preview" width="100%">
</div>

<div align="center">
  <p>
    <i> An interactive developer tool to check and fix Obsidian Datacore components against official Obsidian ESLint verification rules. </i>
  </p>
  <hr style="width:30%;">
</div>

Welcome to **ESLint Verifier**, a component linting and verification platform designed for Obsidian Datacore developers. By running a localized ESLint engine and leveraging the recommended rules of `eslint-plugin-obsidianmd`, it helps you quickly locate and autofix code quality issues.

---

## 🚀 Quick Start

To use ESLint Verifier today:
1. **Download the Repository**: Clone or download this repository directly into any folder inside your Obsidian vault.
2. **Install Datacore**: Ensure you have the **Datacore** plugin installed and enabled in Obsidian.
3. **Open the Entry Note**: Open the **`ESLINT VERIFIER.md`** note inside Obsidian to launch the component!

---

## ✨ Features

### 🔄 Dynamic ESLint Caching & Updates
*   📦 **One-Click Local Cache Setup**: Automatically downloads and installs the necessary version of `eslint` and `eslint-plugin-obsidianmd` into a local `data/cache` directory.
*   ⚡ **Dynamic NPM Checks**: Automatically queries NPM to check if newer versions of ESLint or the Obsidian ESLint plugin are available and updates them cleanly.

### 🌌 Interactive Drag-and-Drop & Picker
*   📂 **Drag-and-Drop Target**: Drag a component folder from your Obsidian file explorer or your operating system directly into the lint zone.
*   🚜 **Path Auto-Resolution**: Automatically matches and resolves note paths to execute local file system checks.

### 🎨 Visual Results Explorer & Autofix
*   🌓 **Detailed Lint Console**: Browse through errors and warnings categorized by file and rule. Click to view the exact code lines.
*   🛠️ **One-Click Autofix**: Run the `--fix` pipeline instantly on the target component.
*   🚀 **Obsidian File Bridge**: Click any lint error row to open the source file in your active Obsidian pane at the exact line!

---

## 📦 Directory Index & Components

The package exposes the following compiled files:

| File | Description |
| :--- | :--- |
| **[`ESLINT VERIFIER.md`](ESLINT%20VERIFIER.md)** | The main entry point note designed to be opened in Obsidian. |
| **[`src/index.jsx`](src/index.jsx)** | Bootstrapper component with dynamic status-bar and scrollbar suppression. |
| **[`src/App.jsx`](src/App.jsx)** | Main component shell containing UI states, drag-and-drop handler, and ESLint runners. |
| **[`assets/`](assets/)** | Media assets including preview clips, walkthroughs, and images. |
| **[`data/`](data/)** | Local data caches and temporary ESLint rule configurations. |
| **[`METADATA.md`](METADATA.md)** | Manifest mapping indexing properties and target runtime. |
| **[`CONTRIBUTION.md`](CONTRIBUTION.md)** | Local execution guidelines. |
| **[`LICENSE.md`](LICENSE.md)** | MIT license configuration. |

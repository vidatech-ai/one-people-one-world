const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    title: "One People One World",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  win.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
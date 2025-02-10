import { app as t, BrowserWindow as i } from "electron";
import { createRequire as d } from "node:module";
import { fileURLToPath as p } from "node:url";
import o from "node:path";
d(import.meta.url);
const a = o.dirname(p(import.meta.url));
process.env.APP_ROOT = o.join(a, "..");
const s = process.env.VITE_DEV_SERVER_URL, _ = o.join(process.env.APP_ROOT, "dist-electron"), c = o.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = s ? o.join(process.env.APP_ROOT, "public") : c;
let e;
function l() {
  e = new i({
    width: 1280,
    height: 720,
    fullscreen: !1,
    icon: o.join(process.env.VITE_PUBLIC, process.platform === "darwin" ? "icon.icns" : "icon.ico"),
    webPreferences: {
      preload: o.join(a, "preload.mjs"),
      devTools: !t.isPackaged
      // Sadece geliştirme modunda devTools aktif
    }
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), s ? e.loadURL(s) : e.loadFile(o.join(c, "index.html")), t.isPackaged && (e.webContents.on("context-menu", (r) => {
    r.preventDefault();
  }), e.webContents.on("before-input-event", (r, n) => {
    (n.control || n.meta) && (n.key.toLowerCase() === "i" || n.key.toLowerCase() === "j" || n.key.toLowerCase() === "c") && r.preventDefault(), n.key === "F12" && r.preventDefault();
  }));
}
t.on("window-all-closed", () => {
  process.platform !== "darwin" && (t.quit(), e = null);
});
t.on("activate", () => {
  i.getAllWindows().length === 0 && l();
});
t.whenReady().then(l);
export {
  _ as MAIN_DIST,
  c as RENDERER_DIST,
  s as VITE_DEV_SERVER_URL
};

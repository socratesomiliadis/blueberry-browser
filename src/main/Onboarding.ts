import { is } from "@electron-toolkit/utils";
import { BaseWindow, WebContentsView } from "electron";
import { join } from "path";

export class Onboarding {
  private webContentsView: WebContentsView;
  private baseWindow: BaseWindow;
  private isVisible = false;

  constructor(baseWindow: BaseWindow) {
    this.baseWindow = baseWindow;
    this.webContentsView = this.createWebContentsView();
    this.webContentsView.setVisible(false);
  }

  show(): void {
    if (!this.isVisible) {
      this.baseWindow.contentView.addChildView(this.webContentsView);
    }

    this.isVisible = true;
    this.webContentsView.setVisible(true);
    this.updateBounds();
  }

  hide(): void {
    if (!this.isVisible) return;

    this.webContentsView.setVisible(false);
    this.baseWindow.contentView.removeChildView(this.webContentsView);
    this.isVisible = false;
  }

  updateBounds(): void {
    const [width, height] = this.baseWindow.getContentSize();
    this.webContentsView.setBounds({ x: 0, y: 0, width, height });
  }

  get view(): WebContentsView {
    return this.webContentsView;
  }

  private createWebContentsView(): WebContentsView {
    const webContentsView = new WebContentsView({
      webPreferences: {
        preload: join(__dirname, "../preload/onboarding.js"),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
    });

    if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
      const onboardingUrl = new URL(
        "/onboarding/",
        process.env["ELECTRON_RENDERER_URL"],
      );
      webContentsView.webContents.loadURL(onboardingUrl.toString());
    } else {
      webContentsView.webContents.loadFile(
        join(__dirname, "../renderer/onboarding.html"),
      );
    }

    return webContentsView;
  }
}

import type { BrowserView, Rectangle } from 'electron';
import type { PickedArticle } from '../../articles/ArticlePicker.js';

export class ArticleScreen {
  private readonly browserView: BrowserView;

  constructor(browserView: BrowserView) {
    this.browserView = browserView;
  }

  public getView(): BrowserView {
    return this.browserView;
  }

  public async load(article: PickedArticle): Promise<void> {
    await this.browserView.webContents.loadURL(article.url);
  }

  public setBounds(bounds: Rectangle): void {
    this.browserView.setBounds(bounds);
  }

  public destroy(): void {
    if (!this.browserView.webContents.isDestroyed()) {
      this.browserView.webContents.stop();
    }
  }
}

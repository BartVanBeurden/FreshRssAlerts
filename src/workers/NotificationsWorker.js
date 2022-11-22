import FreshRssApi from '../shared/FreshRssApi';
import IdSerializer from './IdSerializer';

export default class NotificationsWorker {

    constructor(settingsApi) {
        this.settingsApi = settingsApi;
        this.idSerializer = new IdSerializer("article");

        this.date = new Date();
        this.articles = [];

        browser.notifications.onClicked.addListener(id => this.handleNotificationClick(id));
    }

    async refresh() {
        const serverSettings = await this.settingsApi.loadServerSettings();
        const freshRssApi = new FreshRssApi(serverSettings);

        this.articles = await freshRssApi.getArticles({
            unread: true,
            startDate: this.date
        });
    
        this.date = new Date();
    
        if (this.articles.length > 0) {
            if (this.articles.length <= 3) {
                this.articles.forEach(article => {
                    const notificationId = this.idSerializer.serialize(article.id);
                    browser.notifications.create(notificationId, {
                        type: "basic",
                        iconUrl: browser.extension.getURL("assets/logo.png"),
                        title: article.origin.title,
                        message: article.title
                    });
                });
            } else {
                browser.notifications.create({
                    type: "basic",
                    iconUrl: browser.extension.getURL("assets/logo.png"),
                    title: "New FreshRSS Articles",
                    message: `You have ${this.articles.length} new articles`
                });
            }
        }
    }

    async handleNotificationClick(id) {
        const articleId = this.idSerializer.parse(id);

        if (articleId) {
            const article = this.articles.find(x => x.id == articleId);
            if (article != null) {
                window.open(article.canonical[0].href);
                const serverSettings = await this.settingsApi.loadServerSettings();
                const freshRssApi = new FreshRssApi(serverSettings);
                await freshRssApi.markArticleAsRead(articleId);
            }
        }
    }

}
'use strict';class SettingsApi {

    constructor() {
    }

    async loadServerSettings() {
        return (await browser.storage.local.get({ "server": {
            url: "localhost",
            auth: {
                username: "admin",
                apiPassword: "test"
            }
        }})).server;
    }

    async saveServerSettings(settings) {
        await browser.storage.local.set({ "server": settings });
    }

    async loadAppSettings() {
        return (await browser.storage.local.get({ "application": {
            pollingInterval: 10,
            articleCount: 20,
            markAsRead: true
        }})).application;
    }

    async saveAppSettings(settings) {
        await browser.storage.local.set({ "application": settings });
    }

}const tags = {
    read: "user/-/state/com.google/read",
    star: "user/-/state/com.google/starred"
};

class FreshRssApi {

    constructor(options) {
        this.options = options;
        this.auth = null;
        this.token = null;
    }

    get baseUrl() {
        return `${this.options.url}/api/greader.php`;
    }

    get authUrl() {
        return `${this.baseUrl}/accounts/ClientLogin?Email=${encodeURIComponent(this.options.auth.username)}&Passwd=${encodeURIComponent(this.options.auth.apiPassword)}`;
    }

    async testConnection() {
        const response = await fetch(this.baseUrl);

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText
        };
    }

    async testAuthentication() {
        const response = await fetch(this.authUrl);
        const val = this.getAuthValue(await response.text());

        return {
            success: response.ok && val,
            status: response.status,
            statusText: response.statusText
        };
    }

    async authenticate() {
        if (this.auth == null) {
            const response = await fetch(this.authUrl);
            this.auth = this.getAuthValue(await response.text());
        }
    }

    async authenticateToken() {
        await this.authenticate();
        if (this.token == null) {
            const requestUrl = `${this.baseUrl}/reader/api/0/token`;
            const response = await fetch(requestUrl, { headers: this.getAuthHeaders() });
            const text = await response.text();
            this.token = text.trim();
        }
    }

    async getArticles(options) {
        await this.authenticate();

        const requestParams = new URLSearchParams();
        if (options.count) requestParams.append("n", options.count);
        if (options.unread) requestParams.append("xt", tags.read);
        if (options.startDate) requestParams.append("ot", Math.round(options.startDate.getTime() / 1000));
        if (options.endDate) requestParams.append("nt", Math.round(options.endDate.getTime() / 1000));

        const requestUrl = `${this.baseUrl}/reader/api/0/stream/contents/reading-list?${requestParams.toString()}`;
        const response = await fetch(requestUrl, { headers: this.getAuthHeaders() });
        const json = await response.json();
        return json.items;
    }

    async markArticleAsRead(articleId) {
        await this.authenticateToken();

        const body = new URLSearchParams();
        body.append("a", tags.read);
        body.append("i", articleId);
        body.append("T", this.token);

        const requestUrl = `${this.baseUrl}/reader/api/0/edit-tag`;
        const response = await fetch(requestUrl, { method: "POST", headers: this.getAuthHeaders(), body });
        return response.ok;
    }

    async getUnreadCount() {
        await this.authenticate();
        const requestUrl = `${this.baseUrl}/reader/api/0/unread-count?output=json`;
        const response = await fetch(requestUrl, { headers: this.getAuthHeaders() });
        const json = await response.json();
        return json.max;
    }

    getAuthValue(text) {
        const lines = text.split('\n');
        const auth = lines.find(x => x.startsWith("Auth="));
        const val = auth.split("=", 2);
        return val[1];
    }

    getAuthHeaders() {
        return {
            "Authorization": `GoogleLogin auth=${this.auth}`
        }
    }

}class BadgeWorker {

    constructor(settingsApi) {
        this.settingsApi = settingsApi;
    }

    async refresh() {
        const serverSettings = await this.settingsApi.loadServerSettings();
        const freshRssApi = new FreshRssApi(serverSettings);
        const count = await freshRssApi.getUnreadCount();
        const text = Math.min(count, 999).toString();

        browser.browserAction.setBadgeText({ text });
    }

}class IdSerializer {

    constructor(typeName) {
        this.typeName = typeName;
    }

    serialize(value) {
        return `${this.typeName}:${value}`;
    }

    parse(text) {
        if (!text.startsWith(this.typeName + ":"))
            return false;

        return text.substring(this.typeName.length + 1);
    }

}class NotificationsWorker {

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

}const settingsApi = new SettingsApi();

const workers = [
    new BadgeWorker(settingsApi),
    new NotificationsWorker(settingsApi)
];

async function startPolling() {
    const appSettings = await settingsApi.loadAppSettings();
    setTimeout(refresh, appSettings.pollingInterval * 60 * 1000);
}
async function refresh() {
    for (let worker of workers) {
        await worker.refresh();
    }

    await startPolling();
}

async function main() {
    refresh();
}
main();
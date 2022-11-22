import FreshRssApi from '../shared/FreshRssApi';

export default class BadgeWorker {

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

};

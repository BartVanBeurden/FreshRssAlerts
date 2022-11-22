export default class SettingsApi {

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
            articleCount: 8,
            markAsRead: true
        }})).application;
    }

    async saveAppSettings(settings) {
        await browser.storage.local.set({ "application": settings });
    }

};

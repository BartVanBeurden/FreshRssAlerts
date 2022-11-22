import EventEmitter from 'events';

export default class BaseSettingsService extends EventEmitter {

    constructor(key) {
        super();
        this.key = key;

        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName != "local") return;
            if (!(this.key in changes)) return;
            this.emit("update", changes[this.key]);
        });
    }

    async load() {
        return (await browser.storage.local.get({ [this.key]: {
            url: "localhost",
            auth: {
                username: "admin",
                apiPassword: "test"
            }
        }}))[this.key];
    }

    async save(settings) {
        await browser.storage.local.set({ [this.key]: settings });
    }

};

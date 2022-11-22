export default class RefreshBadgeAction {

    constructor(freshRssService) {
        this.freshRssService = freshRssService;
    }

    async run() {
        const count = await this.freshRssService.getUnreadCount();
        const text = Math.min(count, 999).toString();
        browser.browserAction.setBadgeText({ text });
    }

};

import RefreshBadgeAction from './RefreshBadgeAction';

export default class ReadArticleAction {

    constructor(freshRssService) {
        this.freshRssService = freshRssService;
        this.refreshBadgeAction = new RefreshBadgeAction(freshRssService);
    }

    async run(article) {
        await this.freshRssService.markArticleAsRead(article.id);
        await this.refreshBadgeAction.run();
    }

};

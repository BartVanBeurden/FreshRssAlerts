import { getArticleHref } from '../utils';
import ReadArticleAction from './ReadArticleAction';

export default class OpenArticleAction {

    constructor(appSettingsService, freshRssService) {
        this.appSettingsService = appSettingsService;
        this.freshRssService = freshRssService;
        this.readArticleAction = new ReadArticleAction(freshRssService);
    }

    async run(article) {
        window.open(getArticleHref(article));

        const appSettings = await this.appSettingsService.load();

        if (appSettings.markAsRead) {
            await this.readArticleAction.run(article);
        }
    }

};

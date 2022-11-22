import RefreshBadgeAction from '../shared/actions/RefreshBadgeAction';

export default class BadgeWorker {

    constructor(freshRssService) {
        this.freshRssService = freshRssService;
        this.refreshBadgeAction = new RefreshBadgeAction(freshRssService);
    }

    async refresh() {
        this.refreshBadgeAction.run();
    }

};

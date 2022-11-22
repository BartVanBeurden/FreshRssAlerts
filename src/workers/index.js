import ApplicationSettingsService from '../shared/services/ApplicationSettingsService';
import ServerSettingsService from '../shared/services/ServerSettingsService';
import FreshRssService from '../shared/services/FreshRssService';
import BadgeWorker from './BadgeWorker';
import NotificationsWorker from './NotificationsWorker';

const appSettingsService = new ApplicationSettingsService();
const serverSettingsService = new ServerSettingsService();
const freshRssService = new FreshRssService(serverSettingsService);

const workers = [
    new BadgeWorker(freshRssService),
    new NotificationsWorker(appSettingsService, freshRssService)
];

async function startPolling() {
    const appSettings = await appSettingsService.load();
    setTimeout(refresh, appSettings.pollingInterval * 60 * 1000);
};

async function refresh() {
    for (let worker of workers) {
        await worker.refresh();
    }

    await startPolling();
}

async function main() {
    refresh();
};

main();

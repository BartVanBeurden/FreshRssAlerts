import SettingsApi from '../shared/SettingsApi';
import BadgeWorker from './BadgeWorker';
import NotificationsWorker from './NotificationsWorker';

const settingsApi = new SettingsApi();

const workers = [
    new BadgeWorker(settingsApi),
    new NotificationsWorker(settingsApi)
];

async function startPolling() {
    const appSettings = await settingsApi.loadAppSettings();
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

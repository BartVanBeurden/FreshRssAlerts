import App from './App.svelte';
import ApplicationSettingsService from '../../shared/services/ApplicationSettingsService';
import ServerSettingsService from '../../shared/services/ServerSettingsService';
import FreshRssService from '../../shared/services/FreshRssService';

const appSettingsService = new ApplicationSettingsService();
const serverSettingsService = new ServerSettingsService();
const freshRssService = new FreshRssService(serverSettingsService);

const app = new App({ 
    target: document.body,
    props: {
        appSettingsService,
        serverSettingsService,
        freshRssService
    }
});

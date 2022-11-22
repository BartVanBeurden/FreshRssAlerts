{#if serverSettings}

<h1>Server</h1>

<div class="form">

    <label class="field">
        <div class="field-label">URL</div>
        <div class="field-value"><input bind:value={serverSettings.url} style="width: 90%;" /></div>
    </label>

    <label class="field">
        <div class="field-label"><button on:click={testConnection}>Test Connection</button></div>
        <div class="field-value">{connectionStatus}</div>
    </label>

</div>

<h1>Authentication</h1>

<div class="form">

    <label class="field">
        <div class="field-label">Username</div>
        <div class="field-value"><input bind:value={serverSettings.auth.username} /></div>
    </label>

    <label class="field">
        <div class="field-label">API Password</div>
        <div class="field-value"><input bind:value={serverSettings.auth.apiPassword} type="password" /></div>
    </label>

    <label class="field">
        <div class="field-label"><button on:click={testLogin}>Test Login</button></div>
        <div class="field-value">{loginStatus}</div>
    </label>

</div>

{/if}

{#if appSettings}

<h1>Notifications</h1>

<div class="form">

    <label class="field">
        <div class="field-label">Polling Interval</div>
        <div class="field-value"><input bind:value={appSettings.pollingInterval} type="number" min=5 /> minutes</div>
    </label>

    <label class="field">
        <div class="field-label">Article Count</div>
        <div class="field-value"><input bind:value={appSettings.articleCount} type="number" /></div>
    </label>

    <label class="field">
        <div class="field-label">Mark article as read when opened</div>
        <div class="field-value"><input bind:checked={appSettings.markAsRead} type="checkbox" /></div>
    </label>

</div>

{/if}

<style>
    
    h1 {
        margin: 0;
        padding: 0.25em 0;
    }

    .form {
        display: flex;
        flex-direction: column;
    }

    .field {
        display: flex;
        flex-direction: row;
        align-items: center;
        padding: 0.25em 0;
    }

    .field-label {
        flex: 0 0 10em;
    }

    .field-value {
        flex: 1 1 auto;
    }


</style>

<script>

    import { onMount } from 'svelte';

    export let appSettingsService;
    export let serverSettingsService;
    export let freshRssService;

    let serverSettings = false;
    let appSettings = false;

    let connectionStatus = "";
    let loginStatus = "";

    $: serverSettings && serverSettingsService.save(serverSettings);
    $: appSettings && appSettingsService.save(appSettings);

    async function testConnection() {
        connectionStatus = "Testing...";
        const result = await freshRssService.testConnection();
        const status = result.success ? "Pass" : "Error";
        connectionStatus = `${status}: ${result.status} ${result.statusText}`;
    };

    async function testLogin() {
        loginStatus = "Testing...";
        const result = await freshRssService.testAuthentication();
        const status = result.success ? "Pass": "Error";
        loginStatus = `${status}: ${result.status} ${result.statusText}`;
    }

    onMount(async () => {
        serverSettings = await serverSettingsService.load();
        appSettings = await appSettingsService.load();
    });

</script>
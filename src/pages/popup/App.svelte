{#if isMounted}

<div class="app">

    <div class="main header">
        <button class="title" on:click={openHomepage}>{serverSettings.url} ({serverSettings.auth.username})</button>
        <button class="controls icon" title="Refresh" on:click={refreshArticles}>&#xe984;</button>
    </div>

    <div class="app-content">
        {#each articles as article}
        <div class="article">
            <div class="header">
                <button class="title nowrap" title={article.title} on:click={() => openArticle(article)}>{article.title}</button>
                <div class="controls">
                    <button class="icon" title="Mark as read" on:click={() => readArticle(article)}>&#xe9ce;</button>
                </div>
            </div>
            <div class="meta">
                <a href="{article.origin.htmlUrl}" class="origin"><img src="{getArticleFavicon(article)}" alt="" />{article.origin.title}</a>
                <div class="date">{new Date(article.published * 1000).toLocaleString()}</div>
            </div>
            <div class="description nowrap">{stripHtml(article.summary.content)}</div>
        </div>
        {/each}
    </div>

</div>

{/if}

<style>

    .app {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        padding: 0.5em;
        max-width: 40em;
        font-size: 0.8em;
    }

    .header {
        display: flex;
        flex-direction: row;
        flex: 0 0 auto;
        padding: 0.25em;
        border-bottom: 1px solid #DDD;
    }

    .main.header {
        background: #0062BE;
        color: white;
    }

    .title {
        flex: 1 1 auto;
        text-align: left;
        display: flex;
        align-items: center;
        column-gap: 0.25em;
    }

    .title, .origin {
        font-weight: 600;
    }

    .origin img {
        height: 1em;
    }

    .controls {
        flex: 0 0 auto;
    }

    .app-content {
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
        overflow-y: auto;
    }

    .article {
        margin: 0.25em;
        padding: 0.25em;
        border: 1px solid #DDD;
        display: flex;
        flex-direction: column;
    }

    .article:hover {
        background: #EEE;
    }

    .article > * {
        display: flex;
        flex-direction: row;
        padding: 0.1em;
        column-gap: 0.5em;
    }

    .article .meta {
        font-style: italic;
        font-size: 1em;
    }

    .article .meta .origin {
        display: flex;
        align-items: center;
        column-gap: 0.25em;
    }

    .article .description {
        color: #777;
        font-size: 0.8em;
    }

    .nowrap {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        display: block;
    }

    button {
        border: 0;
        padding: 0;
        margin: 0;
        font-size: 1em;
        background: transparent;
        color: inherit;
        cursor: pointer;
    }

    button.icon {
        padding: 0em 0.25em;
    }

    a {
        color: inherit;
        text-decoration: none;
    }

</style>

<script>

    import { onMount } from 'svelte';
    import { getArticleFavicon } from '../../shared/utils';
    import OpenArticleAction from '../../shared/actions/OpenArticleAction';
    import ReadArticleAction from '../../shared/actions/ReadArticleAction';
    
    export let freshRssService;
    export let appSettingsService;
    export let serverSettingsService;
    
    let isMounted = false;
    let serverSettings = false;
    let appSettings = false;
    let articles = [];

    $: openArticleAction = new OpenArticleAction(appSettingsService, freshRssService);
    $: readArticleAction = new ReadArticleAction(freshRssService);

    async function openHomepage() {
        window.open(serverSettings.url);
        window.close();
    }

    async function refreshArticles() {
        articles = [];
        articles = await freshRssService.getArticles({
            count: appSettings.articleCount,
            unread: true
        });
    };

    async function openArticle(article) {
        if (appSettings.markAsRead) {
            articles = articles.filter(x => x != article);
        }
        await openArticleAction.run(article);
    }

    async function readArticle(article) {
        await readArticleAction.run(article);
    }

    function stripHtml(text) {
        const elm = document.createElement("div");
        elm.innerHTML = text;
        return elm.textContent;
    }

    onMount(async () => {
        serverSettings = await serverSettingsService.load();
        appSettings = await appSettingsService.load();

        refreshArticles();

        isMounted = true;
    });

</script>
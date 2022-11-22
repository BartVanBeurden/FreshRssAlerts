export const getArticleHref = (article) => {
    if (article.canonical && article.canonical.length)
        return article.canonical[0].href;

    if (article.alternate && article.alternate.length)
        return article.alternate[0].href;
        
    return "about:blank";
};

export const getArticleFavicon = (article) => {
    const href = getArticleHref(article);
    const url = new URL(href);
    return `${url.origin}/favicon.ico`;
}

'use strict';function noop() { }
function add_location(element, file, line, column, char) {
    element.__svelte_meta = {
        loc: { file, line, column, char }
    };
}
function run(fn) {
    return fn();
}
function blank_object() {
    return Object.create(null);
}
function run_all(fns) {
    fns.forEach(run);
}
function is_function(thing) {
    return typeof thing === 'function';
}
function safe_not_equal(a, b) {
    return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
}
let src_url_equal_anchor;
function src_url_equal(element_src, url) {
    if (!src_url_equal_anchor) {
        src_url_equal_anchor = document.createElement('a');
    }
    src_url_equal_anchor.href = url;
    return element_src === src_url_equal_anchor.href;
}
function is_empty(obj) {
    return Object.keys(obj).length === 0;
}
function append(target, node) {
    target.appendChild(node);
}
function append_styles(target, style_sheet_id, styles) {
    const append_styles_to = get_root_for_style(target);
    if (!append_styles_to.getElementById(style_sheet_id)) {
        const style = element('style');
        style.id = style_sheet_id;
        style.textContent = styles;
        append_stylesheet(append_styles_to, style);
    }
}
function get_root_for_style(node) {
    if (!node)
        return document;
    const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
    if (root && root.host) {
        return root;
    }
    return node.ownerDocument;
}
function append_stylesheet(node, style) {
    append(node.head || node, style);
    return style.sheet;
}
function insert(target, node, anchor) {
    target.insertBefore(node, anchor || null);
}
function detach(node) {
    if (node.parentNode) {
        node.parentNode.removeChild(node);
    }
}
function destroy_each(iterations, detaching) {
    for (let i = 0; i < iterations.length; i += 1) {
        if (iterations[i])
            iterations[i].d(detaching);
    }
}
function element(name) {
    return document.createElement(name);
}
function text(data) {
    return document.createTextNode(data);
}
function space() {
    return text(' ');
}
function empty() {
    return text('');
}
function listen(node, event, handler, options) {
    node.addEventListener(event, handler, options);
    return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
    if (value == null)
        node.removeAttribute(attribute);
    else if (node.getAttribute(attribute) !== value)
        node.setAttribute(attribute, value);
}
function children(element) {
    return Array.from(element.childNodes);
}
function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
    const e = document.createEvent('CustomEvent');
    e.initCustomEvent(type, bubbles, cancelable, detail);
    return e;
}

let current_component;
function set_current_component(component) {
    current_component = component;
}
function get_current_component() {
    if (!current_component)
        throw new Error('Function called outside component initialization');
    return current_component;
}
/**
 * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
 * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
 * it can be called from an external module).
 *
 * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
 *
 * https://svelte.dev/docs#run-time-svelte-onmount
 */
function onMount(fn) {
    get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
let update_scheduled = false;
function schedule_update() {
    if (!update_scheduled) {
        update_scheduled = true;
        resolved_promise.then(flush);
    }
}
function add_render_callback(fn) {
    render_callbacks.push(fn);
}
// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();
let flushidx = 0; // Do *not* move this inside the flush() function
function flush() {
    const saved_component = current_component;
    do {
        // first, call beforeUpdate functions
        // and update components
        while (flushidx < dirty_components.length) {
            const component = dirty_components[flushidx];
            flushidx++;
            set_current_component(component);
            update(component.$$);
        }
        set_current_component(null);
        dirty_components.length = 0;
        flushidx = 0;
        while (binding_callbacks.length)
            binding_callbacks.pop()();
        // then, once components are updated, call
        // afterUpdate functions. This may cause
        // subsequent updates...
        for (let i = 0; i < render_callbacks.length; i += 1) {
            const callback = render_callbacks[i];
            if (!seen_callbacks.has(callback)) {
                // ...so guard against infinite loops
                seen_callbacks.add(callback);
                callback();
            }
        }
        render_callbacks.length = 0;
    } while (dirty_components.length);
    while (flush_callbacks.length) {
        flush_callbacks.pop()();
    }
    update_scheduled = false;
    seen_callbacks.clear();
    set_current_component(saved_component);
}
function update($$) {
    if ($$.fragment !== null) {
        $$.update();
        run_all($$.before_update);
        const dirty = $$.dirty;
        $$.dirty = [-1];
        $$.fragment && $$.fragment.p($$.ctx, dirty);
        $$.after_update.forEach(add_render_callback);
    }
}
const outroing = new Set();
function transition_in(block, local) {
    if (block && block.i) {
        outroing.delete(block);
        block.i(local);
    }
}
function mount_component(component, target, anchor, customElement) {
    const { fragment, after_update } = component.$$;
    fragment && fragment.m(target, anchor);
    if (!customElement) {
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
            // if the component was destroyed immediately
            // it will update the `$$.on_destroy` reference to `null`.
            // the destructured on_destroy may still reference to the old array
            if (component.$$.on_destroy) {
                component.$$.on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
    }
    after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
    const $$ = component.$$;
    if ($$.fragment !== null) {
        run_all($$.on_destroy);
        $$.fragment && $$.fragment.d(detaching);
        // TODO null out other refs, including component.$$ (but need to
        // preserve final state?)
        $$.on_destroy = $$.fragment = null;
        $$.ctx = [];
    }
}
function make_dirty(component, i) {
    if (component.$$.dirty[0] === -1) {
        dirty_components.push(component);
        schedule_update();
        component.$$.dirty.fill(0);
    }
    component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
}
function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
    const parent_component = current_component;
    set_current_component(component);
    const $$ = component.$$ = {
        fragment: null,
        ctx: [],
        // state
        props,
        update: noop,
        not_equal,
        bound: blank_object(),
        // lifecycle
        on_mount: [],
        on_destroy: [],
        on_disconnect: [],
        before_update: [],
        after_update: [],
        context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
        // everything else
        callbacks: blank_object(),
        dirty,
        skip_bound: false,
        root: options.target || parent_component.$$.root
    };
    append_styles && append_styles($$.root);
    let ready = false;
    $$.ctx = instance
        ? instance(component, options.props || {}, (i, ret, ...rest) => {
            const value = rest.length ? rest[0] : ret;
            if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                if (!$$.skip_bound && $$.bound[i])
                    $$.bound[i](value);
                if (ready)
                    make_dirty(component, i);
            }
            return ret;
        })
        : [];
    $$.update();
    ready = true;
    run_all($$.before_update);
    // `false` as a special case of no DOM component
    $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
    if (options.target) {
        if (options.hydrate) {
            const nodes = children(options.target);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.l(nodes);
            nodes.forEach(detach);
        }
        else {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            $$.fragment && $$.fragment.c();
        }
        if (options.intro)
            transition_in(component.$$.fragment);
        mount_component(component, options.target, options.anchor, options.customElement);
        flush();
    }
    set_current_component(parent_component);
}
/**
 * Base class for Svelte components. Used when dev=false.
 */
class SvelteComponent {
    $destroy() {
        destroy_component(this, 1);
        this.$destroy = noop;
    }
    $on(type, callback) {
        if (!is_function(callback)) {
            return noop;
        }
        const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
        callbacks.push(callback);
        return () => {
            const index = callbacks.indexOf(callback);
            if (index !== -1)
                callbacks.splice(index, 1);
        };
    }
    $set($$props) {
        if (this.$$set && !is_empty($$props)) {
            this.$$.skip_bound = true;
            this.$$set($$props);
            this.$$.skip_bound = false;
        }
    }
}

function dispatch_dev(type, detail) {
    document.dispatchEvent(custom_event(type, Object.assign({ version: '3.53.1' }, detail), { bubbles: true }));
}
function append_dev(target, node) {
    dispatch_dev('SvelteDOMInsert', { target, node });
    append(target, node);
}
function insert_dev(target, node, anchor) {
    dispatch_dev('SvelteDOMInsert', { target, node, anchor });
    insert(target, node, anchor);
}
function detach_dev(node) {
    dispatch_dev('SvelteDOMRemove', { node });
    detach(node);
}
function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
    const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
    if (has_prevent_default)
        modifiers.push('preventDefault');
    if (has_stop_propagation)
        modifiers.push('stopPropagation');
    dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
    const dispose = listen(node, event, handler, options);
    return () => {
        dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
        dispose();
    };
}
function attr_dev(node, attribute, value) {
    attr(node, attribute, value);
    if (value == null)
        dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
    else
        dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
}
function set_data_dev(text, data) {
    data = '' + data;
    if (text.wholeText === data)
        return;
    dispatch_dev('SvelteDOMSetData', { node: text, data });
    text.data = data;
}
function validate_each_argument(arg) {
    if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
        let msg = '{#each} only iterates over array-like objects.';
        if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
            msg += ' You can use a spread to convert this iterable into an array.';
        }
        throw new Error(msg);
    }
}
function validate_slots(name, slot, keys) {
    for (const slot_key of Object.keys(slot)) {
        if (!~keys.indexOf(slot_key)) {
            console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
        }
    }
}
/**
 * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
 */
class SvelteComponentDev extends SvelteComponent {
    constructor(options) {
        if (!options || (!options.target && !options.$$inline)) {
            throw new Error("'target' is a required option");
        }
        super();
    }
    $destroy() {
        super.$destroy();
        this.$destroy = () => {
            console.warn('Component was already destroyed'); // eslint-disable-line no-console
        };
    }
    $capture_state() { }
    $inject_state() { }
}const getArticleHref = (article) => {
    if (article.canonical && article.canonical.length)
        return article.canonical[0].href;

    if (article.alternate && article.alternate.length)
        return article.alternate[0].href;
        
    return "about:blank";
};

const getArticleFavicon = (article) => {
    const href = getArticleHref(article);
    const url = new URL(href);
    return `${url.origin}/favicon.ico`;
};class RefreshBadgeAction {

    constructor(freshRssService) {
        this.freshRssService = freshRssService;
    }

    async run() {
        const count = await this.freshRssService.getUnreadCount();
        const text = Math.min(count, 999).toString();
        browser.browserAction.setBadgeText({ text });
    }

}class ReadArticleAction {

    constructor(freshRssService) {
        this.freshRssService = freshRssService;
        this.refreshBadgeAction = new RefreshBadgeAction(freshRssService);
    }

    async run(article) {
        await this.freshRssService.markArticleAsRead(article.id);
        await this.refreshBadgeAction.run();
    }

}class OpenArticleAction {

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

}/* src\pages\popup\App.svelte generated by Svelte v3.53.1 */
const file = "src\\pages\\popup\\App.svelte";

function add_css(target) {
	append_styles(target, "svelte-1a2k4ni", ".app.svelte-1a2k4ni.svelte-1a2k4ni{display:flex;flex-direction:column;width:100%;height:100%;padding:0.5em;max-width:40em;font-size:0.8em}.header.svelte-1a2k4ni.svelte-1a2k4ni{display:flex;flex-direction:row;flex:0 0 auto;padding:0.25em;border-bottom:1px solid #DDD}.main.header.svelte-1a2k4ni.svelte-1a2k4ni{background:#0062BE;color:white}.title.svelte-1a2k4ni.svelte-1a2k4ni{flex:1 1 auto;text-align:left;display:flex;align-items:center;column-gap:0.25em}.title.svelte-1a2k4ni.svelte-1a2k4ni,.origin.svelte-1a2k4ni.svelte-1a2k4ni{font-weight:600}.origin.svelte-1a2k4ni img.svelte-1a2k4ni{height:1em}.controls.svelte-1a2k4ni.svelte-1a2k4ni{flex:0 0 auto}.app-content.svelte-1a2k4ni.svelte-1a2k4ni{display:flex;flex-direction:column;flex:1 1 auto;overflow-y:auto}.article.svelte-1a2k4ni.svelte-1a2k4ni{margin:0.25em;padding:0.25em;border:1px solid #DDD;display:flex;flex-direction:column}.article.svelte-1a2k4ni.svelte-1a2k4ni:hover{background:#EEE}.article.svelte-1a2k4ni>.svelte-1a2k4ni{display:flex;flex-direction:row;padding:0.1em;column-gap:0.5em}.article.svelte-1a2k4ni .meta.svelte-1a2k4ni{font-style:italic;font-size:1em}.article.svelte-1a2k4ni .meta .origin.svelte-1a2k4ni{display:flex;align-items:center;column-gap:0.25em}.article.svelte-1a2k4ni .description.svelte-1a2k4ni{color:#777;font-size:0.8em}.nowrap.svelte-1a2k4ni.svelte-1a2k4ni{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}button.svelte-1a2k4ni.svelte-1a2k4ni{border:0;padding:0;margin:0;font-size:1em;background:transparent;color:inherit;cursor:pointer}button.icon.svelte-1a2k4ni.svelte-1a2k4ni{padding:0em 0.25em}a.svelte-1a2k4ni.svelte-1a2k4ni{color:inherit;text-decoration:none}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyJ7I2lmIGlzTW91bnRlZH1cclxuXHJcbjxkaXYgY2xhc3M9XCJhcHBcIj5cclxuXHJcbiAgICA8ZGl2IGNsYXNzPVwibWFpbiBoZWFkZXJcIj5cclxuICAgICAgICA8YnV0dG9uIGNsYXNzPVwidGl0bGVcIiBvbjpjbGljaz17b3BlbkhvbWVwYWdlfT57c2VydmVyU2V0dGluZ3MudXJsfSAoe3NlcnZlclNldHRpbmdzLmF1dGgudXNlcm5hbWV9KTwvYnV0dG9uPlxyXG4gICAgICAgIDxidXR0b24gY2xhc3M9XCJjb250cm9scyBpY29uXCIgdGl0bGU9XCJSZWZyZXNoXCIgb246Y2xpY2s9e3JlZnJlc2hBcnRpY2xlc30+JiN4ZTk4NDs8L2J1dHRvbj5cclxuICAgIDwvZGl2PlxyXG5cclxuICAgIDxkaXYgY2xhc3M9XCJhcHAtY29udGVudFwiPlxyXG4gICAgICAgIHsjZWFjaCBhcnRpY2xlcyBhcyBhcnRpY2xlfVxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJhcnRpY2xlXCI+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJoZWFkZXJcIj5cclxuICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJ0aXRsZSBub3dyYXBcIiB0aXRsZT17YXJ0aWNsZS50aXRsZX0gb246Y2xpY2s9eygpID0+IG9wZW5BcnRpY2xlKGFydGljbGUpfT57YXJ0aWNsZS50aXRsZX08L2J1dHRvbj5cclxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJjb250cm9sc1wiPlxyXG4gICAgICAgICAgICAgICAgICAgIDxidXR0b24gY2xhc3M9XCJpY29uXCIgdGl0bGU9XCJNYXJrIGFzIHJlYWRcIiBvbjpjbGljaz17KCkgPT4gcmVhZEFydGljbGUoYXJ0aWNsZSl9PiYjeGU5Y2U7PC9idXR0b24+XHJcbiAgICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgIDxkaXYgY2xhc3M9XCJtZXRhXCI+XHJcbiAgICAgICAgICAgICAgICA8YSBocmVmPVwie2FydGljbGUub3JpZ2luLmh0bWxVcmx9XCIgY2xhc3M9XCJvcmlnaW5cIj48aW1nIHNyYz1cIntnZXRBcnRpY2xlRmF2aWNvbihhcnRpY2xlKX1cIiBhbHQ9XCJcIiAvPnthcnRpY2xlLm9yaWdpbi50aXRsZX08L2E+XHJcbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGF0ZVwiPntuZXcgRGF0ZShhcnRpY2xlLnB1Ymxpc2hlZCAqIDEwMDApLnRvTG9jYWxlU3RyaW5nKCl9PC9kaXY+XHJcbiAgICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgICAgICA8ZGl2IGNsYXNzPVwiZGVzY3JpcHRpb24gbm93cmFwXCI+e3N0cmlwSHRtbChhcnRpY2xlLnN1bW1hcnkuY29udGVudCl9PC9kaXY+XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgey9lYWNofVxyXG4gICAgPC9kaXY+XHJcblxyXG48L2Rpdj5cclxuXHJcbnsvaWZ9XHJcblxyXG48c3R5bGU+XHJcblxyXG4gICAgLmFwcCB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIHdpZHRoOiAxMDAlO1xyXG4gICAgICAgIGhlaWdodDogMTAwJTtcclxuICAgICAgICBwYWRkaW5nOiAwLjVlbTtcclxuICAgICAgICBtYXgtd2lkdGg6IDQwZW07XHJcbiAgICAgICAgZm9udC1zaXplOiAwLjhlbTtcclxuICAgIH1cclxuXHJcbiAgICAuaGVhZGVyIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XHJcbiAgICAgICAgZmxleDogMCAwIGF1dG87XHJcbiAgICAgICAgcGFkZGluZzogMC4yNWVtO1xyXG4gICAgICAgIGJvcmRlci1ib3R0b206IDFweCBzb2xpZCAjREREO1xyXG4gICAgfVxyXG5cclxuICAgIC5tYWluLmhlYWRlciB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogIzAwNjJCRTtcclxuICAgICAgICBjb2xvcjogd2hpdGU7XHJcbiAgICB9XHJcblxyXG4gICAgLnRpdGxlIHtcclxuICAgICAgICBmbGV4OiAxIDEgYXV0bztcclxuICAgICAgICB0ZXh0LWFsaWduOiBsZWZ0O1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgICBjb2x1bW4tZ2FwOiAwLjI1ZW07XHJcbiAgICB9XHJcblxyXG4gICAgLnRpdGxlLCAub3JpZ2luIHtcclxuICAgICAgICBmb250LXdlaWdodDogNjAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5vcmlnaW4gaW1nIHtcclxuICAgICAgICBoZWlnaHQ6IDFlbTtcclxuICAgIH1cclxuXHJcbiAgICAuY29udHJvbHMge1xyXG4gICAgICAgIGZsZXg6IDAgMCBhdXRvO1xyXG4gICAgfVxyXG5cclxuICAgIC5hcHAtY29udGVudCB7XHJcbiAgICAgICAgZGlzcGxheTogZmxleDtcclxuICAgICAgICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG4gICAgICAgIGZsZXg6IDEgMSBhdXRvO1xyXG4gICAgICAgIG92ZXJmbG93LXk6IGF1dG87XHJcbiAgICB9XHJcblxyXG4gICAgLmFydGljbGUge1xyXG4gICAgICAgIG1hcmdpbjogMC4yNWVtO1xyXG4gICAgICAgIHBhZGRpbmc6IDAuMjVlbTtcclxuICAgICAgICBib3JkZXI6IDFweCBzb2xpZCAjREREO1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IGNvbHVtbjtcclxuICAgIH1cclxuXHJcbiAgICAuYXJ0aWNsZTpob3ZlciB7XHJcbiAgICAgICAgYmFja2dyb3VuZDogI0VFRTtcclxuICAgIH1cclxuXHJcbiAgICAuYXJ0aWNsZSA+ICoge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgZmxleC1kaXJlY3Rpb246IHJvdztcclxuICAgICAgICBwYWRkaW5nOiAwLjFlbTtcclxuICAgICAgICBjb2x1bW4tZ2FwOiAwLjVlbTtcclxuICAgIH1cclxuXHJcbiAgICAuYXJ0aWNsZSAubWV0YSB7XHJcbiAgICAgICAgZm9udC1zdHlsZTogaXRhbGljO1xyXG4gICAgICAgIGZvbnQtc2l6ZTogMWVtO1xyXG4gICAgfVxyXG5cclxuICAgIC5hcnRpY2xlIC5tZXRhIC5vcmlnaW4ge1xyXG4gICAgICAgIGRpc3BsYXk6IGZsZXg7XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgICBjb2x1bW4tZ2FwOiAwLjI1ZW07XHJcbiAgICB9XHJcblxyXG4gICAgLmFydGljbGUgLmRlc2NyaXB0aW9uIHtcclxuICAgICAgICBjb2xvcjogIzc3NztcclxuICAgICAgICBmb250LXNpemU6IDAuOGVtO1xyXG4gICAgfVxyXG5cclxuICAgIC5ub3dyYXAge1xyXG4gICAgICAgIG92ZXJmbG93OiBoaWRkZW47XHJcbiAgICAgICAgdGV4dC1vdmVyZmxvdzogZWxsaXBzaXM7XHJcbiAgICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcclxuICAgICAgICBkaXNwbGF5OiBibG9jaztcclxuICAgIH1cclxuXHJcbiAgICBidXR0b24ge1xyXG4gICAgICAgIGJvcmRlcjogMDtcclxuICAgICAgICBwYWRkaW5nOiAwO1xyXG4gICAgICAgIG1hcmdpbjogMDtcclxuICAgICAgICBmb250LXNpemU6IDFlbTtcclxuICAgICAgICBiYWNrZ3JvdW5kOiB0cmFuc3BhcmVudDtcclxuICAgICAgICBjb2xvcjogaW5oZXJpdDtcclxuICAgICAgICBjdXJzb3I6IHBvaW50ZXI7XHJcbiAgICB9XHJcblxyXG4gICAgYnV0dG9uLmljb24ge1xyXG4gICAgICAgIHBhZGRpbmc6IDBlbSAwLjI1ZW07XHJcbiAgICB9XHJcblxyXG4gICAgYSB7XHJcbiAgICAgICAgY29sb3I6IGluaGVyaXQ7XHJcbiAgICAgICAgdGV4dC1kZWNvcmF0aW9uOiBub25lO1xyXG4gICAgfVxyXG5cclxuPC9zdHlsZT5cclxuXHJcbjxzY3JpcHQ+XHJcblxyXG4gICAgaW1wb3J0IHsgb25Nb3VudCB9IGZyb20gJ3N2ZWx0ZSc7XHJcbiAgICBpbXBvcnQgeyBnZXRBcnRpY2xlRmF2aWNvbiB9IGZyb20gJy4uLy4uL3NoYXJlZC91dGlscyc7XHJcbiAgICBpbXBvcnQgT3BlbkFydGljbGVBY3Rpb24gZnJvbSAnLi4vLi4vc2hhcmVkL2FjdGlvbnMvT3BlbkFydGljbGVBY3Rpb24nO1xyXG4gICAgaW1wb3J0IFJlYWRBcnRpY2xlQWN0aW9uIGZyb20gJy4uLy4uL3NoYXJlZC9hY3Rpb25zL1JlYWRBcnRpY2xlQWN0aW9uJztcclxuICAgIFxyXG4gICAgZXhwb3J0IGxldCBmcmVzaFJzc1NlcnZpY2U7XHJcbiAgICBleHBvcnQgbGV0IGFwcFNldHRpbmdzU2VydmljZTtcclxuICAgIGV4cG9ydCBsZXQgc2VydmVyU2V0dGluZ3NTZXJ2aWNlO1xyXG4gICAgXHJcbiAgICBsZXQgaXNNb3VudGVkID0gZmFsc2U7XHJcbiAgICBsZXQgc2VydmVyU2V0dGluZ3MgPSBmYWxzZTtcclxuICAgIGxldCBhcHBTZXR0aW5ncyA9IGZhbHNlO1xyXG4gICAgbGV0IGFydGljbGVzID0gW107XHJcblxyXG4gICAgJDogb3BlbkFydGljbGVBY3Rpb24gPSBuZXcgT3BlbkFydGljbGVBY3Rpb24oYXBwU2V0dGluZ3NTZXJ2aWNlLCBmcmVzaFJzc1NlcnZpY2UpO1xyXG4gICAgJDogcmVhZEFydGljbGVBY3Rpb24gPSBuZXcgUmVhZEFydGljbGVBY3Rpb24oZnJlc2hSc3NTZXJ2aWNlKTtcclxuXHJcbiAgICBhc3luYyBmdW5jdGlvbiBvcGVuSG9tZXBhZ2UoKSB7XHJcbiAgICAgICAgd2luZG93Lm9wZW4oc2VydmVyU2V0dGluZ3MudXJsKTtcclxuICAgICAgICB3aW5kb3cuY2xvc2UoKTtcclxuICAgIH1cclxuXHJcbiAgICBhc3luYyBmdW5jdGlvbiByZWZyZXNoQXJ0aWNsZXMoKSB7XHJcbiAgICAgICAgYXJ0aWNsZXMgPSBbXTtcclxuICAgICAgICBhcnRpY2xlcyA9IGF3YWl0IGZyZXNoUnNzU2VydmljZS5nZXRBcnRpY2xlcyh7XHJcbiAgICAgICAgICAgIGNvdW50OiBhcHBTZXR0aW5ncy5hcnRpY2xlQ291bnQsXHJcbiAgICAgICAgICAgIHVucmVhZDogdHJ1ZVxyXG4gICAgICAgIH0pO1xyXG4gICAgfTtcclxuXHJcbiAgICBhc3luYyBmdW5jdGlvbiBvcGVuQXJ0aWNsZShhcnRpY2xlKSB7XHJcbiAgICAgICAgaWYgKGFwcFNldHRpbmdzLm1hcmtBc1JlYWQpIHtcclxuICAgICAgICAgICAgYXJ0aWNsZXMgPSBhcnRpY2xlcy5maWx0ZXIoeCA9PiB4ICE9IGFydGljbGUpO1xyXG4gICAgICAgIH1cclxuICAgICAgICBhd2FpdCBvcGVuQXJ0aWNsZUFjdGlvbi5ydW4oYXJ0aWNsZSk7XHJcbiAgICB9XHJcblxyXG4gICAgYXN5bmMgZnVuY3Rpb24gcmVhZEFydGljbGUoYXJ0aWNsZSkge1xyXG4gICAgICAgIGF3YWl0IHJlYWRBcnRpY2xlQWN0aW9uLnJ1bihhcnRpY2xlKTtcclxuICAgIH1cclxuXHJcbiAgICBmdW5jdGlvbiBzdHJpcEh0bWwodGV4dCkge1xyXG4gICAgICAgIGNvbnN0IGVsbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XHJcbiAgICAgICAgZWxtLmlubmVySFRNTCA9IHRleHQ7XHJcbiAgICAgICAgcmV0dXJuIGVsbS50ZXh0Q29udGVudDtcclxuICAgIH1cclxuXHJcbiAgICBvbk1vdW50KGFzeW5jICgpID0+IHtcclxuICAgICAgICBzZXJ2ZXJTZXR0aW5ncyA9IGF3YWl0IHNlcnZlclNldHRpbmdzU2VydmljZS5sb2FkKCk7XHJcbiAgICAgICAgYXBwU2V0dGluZ3MgPSBhd2FpdCBhcHBTZXR0aW5nc1NlcnZpY2UubG9hZCgpO1xyXG5cclxuICAgICAgICByZWZyZXNoQXJ0aWNsZXMoKTtcclxuXHJcbiAgICAgICAgaXNNb3VudGVkID0gdHJ1ZTtcclxuICAgIH0pO1xyXG5cclxuPC9zY3JpcHQ+Il0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQWlDSSxJQUFJLDhCQUFDLENBQUMsQUFDRixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLEtBQUssQ0FBRSxJQUFJLENBQ1gsTUFBTSxDQUFFLElBQUksQ0FDWixPQUFPLENBQUUsS0FBSyxDQUNkLFNBQVMsQ0FBRSxJQUFJLENBQ2YsU0FBUyxDQUFFLEtBQUssQUFDcEIsQ0FBQyxBQUVELE9BQU8sOEJBQUMsQ0FBQyxBQUNMLE9BQU8sQ0FBRSxJQUFJLENBQ2IsY0FBYyxDQUFFLEdBQUcsQ0FDbkIsSUFBSSxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUNkLE9BQU8sQ0FBRSxNQUFNLENBQ2YsYUFBYSxDQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxBQUNqQyxDQUFDLEFBRUQsS0FBSyxPQUFPLDhCQUFDLENBQUMsQUFDVixVQUFVLENBQUUsT0FBTyxDQUNuQixLQUFLLENBQUUsS0FBSyxBQUNoQixDQUFDLEFBRUQsTUFBTSw4QkFBQyxDQUFDLEFBQ0osSUFBSSxDQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUNkLFVBQVUsQ0FBRSxJQUFJLENBQ2hCLE9BQU8sQ0FBRSxJQUFJLENBQ2IsV0FBVyxDQUFFLE1BQU0sQ0FDbkIsVUFBVSxDQUFFLE1BQU0sQUFDdEIsQ0FBQyxBQUVELG9DQUFNLENBQUUsT0FBTyw4QkFBQyxDQUFDLEFBQ2IsV0FBVyxDQUFFLEdBQUcsQUFDcEIsQ0FBQyxBQUVELHNCQUFPLENBQUMsR0FBRyxlQUFDLENBQUMsQUFDVCxNQUFNLENBQUUsR0FBRyxBQUNmLENBQUMsQUFFRCxTQUFTLDhCQUFDLENBQUMsQUFDUCxJQUFJLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEFBQ2xCLENBQUMsQUFFRCxZQUFZLDhCQUFDLENBQUMsQUFDVixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxNQUFNLENBQ3RCLElBQUksQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FDZCxVQUFVLENBQUUsSUFBSSxBQUNwQixDQUFDLEFBRUQsUUFBUSw4QkFBQyxDQUFDLEFBQ04sTUFBTSxDQUFFLE1BQU0sQ0FDZCxPQUFPLENBQUUsTUFBTSxDQUNmLE1BQU0sQ0FBRSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksQ0FDdEIsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxBQUMxQixDQUFDLEFBRUQsc0NBQVEsTUFBTSxBQUFDLENBQUMsQUFDWixVQUFVLENBQUUsSUFBSSxBQUNwQixDQUFDLEFBRUQsdUJBQVEsQ0FBRyxlQUFFLENBQUMsQUFDVixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLE9BQU8sQ0FBRSxLQUFLLENBQ2QsVUFBVSxDQUFFLEtBQUssQUFDckIsQ0FBQyxBQUVELHVCQUFRLENBQUMsS0FBSyxlQUFDLENBQUMsQUFDWixVQUFVLENBQUUsTUFBTSxDQUNsQixTQUFTLENBQUUsR0FBRyxBQUNsQixDQUFDLEFBRUQsdUJBQVEsQ0FBQyxLQUFLLENBQUMsT0FBTyxlQUFDLENBQUMsQUFDcEIsT0FBTyxDQUFFLElBQUksQ0FDYixXQUFXLENBQUUsTUFBTSxDQUNuQixVQUFVLENBQUUsTUFBTSxBQUN0QixDQUFDLEFBRUQsdUJBQVEsQ0FBQyxZQUFZLGVBQUMsQ0FBQyxBQUNuQixLQUFLLENBQUUsSUFBSSxDQUNYLFNBQVMsQ0FBRSxLQUFLLEFBQ3BCLENBQUMsQUFFRCxPQUFPLDhCQUFDLENBQUMsQUFDTCxRQUFRLENBQUUsTUFBTSxDQUNoQixhQUFhLENBQUUsUUFBUSxDQUN2QixXQUFXLENBQUUsTUFBTSxDQUNuQixPQUFPLENBQUUsS0FBSyxBQUNsQixDQUFDLEFBRUQsTUFBTSw4QkFBQyxDQUFDLEFBQ0osTUFBTSxDQUFFLENBQUMsQ0FDVCxPQUFPLENBQUUsQ0FBQyxDQUNWLE1BQU0sQ0FBRSxDQUFDLENBQ1QsU0FBUyxDQUFFLEdBQUcsQ0FDZCxVQUFVLENBQUUsV0FBVyxDQUN2QixLQUFLLENBQUUsT0FBTyxDQUNkLE1BQU0sQ0FBRSxPQUFPLEFBQ25CLENBQUMsQUFFRCxNQUFNLEtBQUssOEJBQUMsQ0FBQyxBQUNULE9BQU8sQ0FBRSxHQUFHLENBQUMsTUFBTSxBQUN2QixDQUFDLEFBRUQsQ0FBQyw4QkFBQyxDQUFDLEFBQ0MsS0FBSyxDQUFFLE9BQU8sQ0FDZCxlQUFlLENBQUUsSUFBSSxBQUN6QixDQUFDIn0= */");
}

function get_each_context(ctx, list, i) {
	const child_ctx = ctx.slice();
	child_ctx[15] = list[i];
	return child_ctx;
}

// (1:0) {#if isMounted}
function create_if_block(ctx) {
	let div2;
	let div0;
	let button0;
	let t0_value = /*serverSettings*/ ctx[1].url + "";
	let t0;
	let t1;
	let t2_value = /*serverSettings*/ ctx[1].auth.username + "";
	let t2;
	let t3;
	let t4;
	let button1;
	let t6;
	let div1;
	let mounted;
	let dispose;
	let each_value = /*articles*/ ctx[2];
	validate_each_argument(each_value);
	let each_blocks = [];

	for (let i = 0; i < each_value.length; i += 1) {
		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
	}

	const block = {
		c: function create() {
			div2 = element("div");
			div0 = element("div");
			button0 = element("button");
			t0 = text(t0_value);
			t1 = text(" (");
			t2 = text(t2_value);
			t3 = text(")");
			t4 = space();
			button1 = element("button");
			button1.textContent = "";
			t6 = space();
			div1 = element("div");

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].c();
			}

			attr_dev(button0, "class", "title svelte-1a2k4ni");
			add_location(button0, file, 5, 8, 79);
			attr_dev(button1, "class", "controls icon svelte-1a2k4ni");
			attr_dev(button1, "title", "Refresh");
			add_location(button1, file, 6, 8, 197);
			attr_dev(div0, "class", "main header svelte-1a2k4ni");
			add_location(div0, file, 4, 4, 44);
			attr_dev(div1, "class", "app-content svelte-1a2k4ni");
			add_location(div1, file, 9, 4, 307);
			attr_dev(div2, "class", "app svelte-1a2k4ni");
			add_location(div2, file, 2, 0, 19);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div2, anchor);
			append_dev(div2, div0);
			append_dev(div0, button0);
			append_dev(button0, t0);
			append_dev(button0, t1);
			append_dev(button0, t2);
			append_dev(button0, t3);
			append_dev(div0, t4);
			append_dev(div0, button1);
			append_dev(div2, t6);
			append_dev(div2, div1);

			for (let i = 0; i < each_blocks.length; i += 1) {
				each_blocks[i].m(div1, null);
			}

			if (!mounted) {
				dispose = [
					listen_dev(button0, "click", /*openHomepage*/ ctx[3], false, false, false),
					listen_dev(button1, "click", /*refreshArticles*/ ctx[4], false, false, false)
				];

				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*serverSettings*/ 2 && t0_value !== (t0_value = /*serverSettings*/ ctx[1].url + "")) set_data_dev(t0, t0_value);
			if (dirty & /*serverSettings*/ 2 && t2_value !== (t2_value = /*serverSettings*/ ctx[1].auth.username + "")) set_data_dev(t2, t2_value);

			if (dirty & /*stripHtml, articles, Date, getArticleFavicon, readArticle, openArticle*/ 100) {
				each_value = /*articles*/ ctx[2];
				validate_each_argument(each_value);
				let i;

				for (i = 0; i < each_value.length; i += 1) {
					const child_ctx = get_each_context(ctx, each_value, i);

					if (each_blocks[i]) {
						each_blocks[i].p(child_ctx, dirty);
					} else {
						each_blocks[i] = create_each_block(child_ctx);
						each_blocks[i].c();
						each_blocks[i].m(div1, null);
					}
				}

				for (; i < each_blocks.length; i += 1) {
					each_blocks[i].d(1);
				}

				each_blocks.length = each_value.length;
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div2);
			destroy_each(each_blocks, detaching);
			mounted = false;
			run_all(dispose);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(1:0) {#if isMounted}",
		ctx
	});

	return block;
}

// (11:8) {#each articles as article}
function create_each_block(ctx) {
	let div5;
	let div1;
	let button0;
	let t0_value = /*article*/ ctx[15].title + "";
	let t0;
	let button0_title_value;
	let t1;
	let div0;
	let button1;
	let t3;
	let div3;
	let a;
	let img;
	let img_src_value;
	let t4_value = /*article*/ ctx[15].origin.title + "";
	let t4;
	let a_href_value;
	let t5;
	let div2;
	let t6_value = new Date(/*article*/ ctx[15].published * 1000).toLocaleString() + "";
	let t6;
	let t7;
	let div4;
	let t8_value = stripHtml(/*article*/ ctx[15].summary.content) + "";
	let t8;
	let t9;
	let mounted;
	let dispose;

	function click_handler() {
		return /*click_handler*/ ctx[10](/*article*/ ctx[15]);
	}

	function click_handler_1() {
		return /*click_handler_1*/ ctx[11](/*article*/ ctx[15]);
	}

	const block = {
		c: function create() {
			div5 = element("div");
			div1 = element("div");
			button0 = element("button");
			t0 = text(t0_value);
			t1 = space();
			div0 = element("div");
			button1 = element("button");
			button1.textContent = "";
			t3 = space();
			div3 = element("div");
			a = element("a");
			img = element("img");
			t4 = text(t4_value);
			t5 = space();
			div2 = element("div");
			t6 = text(t6_value);
			t7 = space();
			div4 = element("div");
			t8 = text(t8_value);
			t9 = space();
			attr_dev(button0, "class", "title nowrap svelte-1a2k4ni");
			attr_dev(button0, "title", button0_title_value = /*article*/ ctx[15].title);
			add_location(button0, file, 13, 16, 452);
			attr_dev(button1, "class", "icon svelte-1a2k4ni");
			attr_dev(button1, "title", "Mark as read");
			add_location(button1, file, 15, 20, 627);
			attr_dev(div0, "class", "controls svelte-1a2k4ni");
			add_location(div0, file, 14, 16, 583);
			attr_dev(div1, "class", "header svelte-1a2k4ni");
			add_location(div1, file, 12, 12, 414);
			if (!src_url_equal(img.src, img_src_value = getArticleFavicon(/*article*/ ctx[15]))) attr_dev(img, "src", img_src_value);
			attr_dev(img, "alt", "");
			attr_dev(img, "class", "svelte-1a2k4ni");
			add_location(img, file, 19, 66, 868);
			attr_dev(a, "href", a_href_value = /*article*/ ctx[15].origin.htmlUrl);
			attr_dev(a, "class", "origin svelte-1a2k4ni");
			add_location(a, file, 19, 16, 818);
			attr_dev(div2, "class", "date");
			add_location(div2, file, 20, 16, 961);
			attr_dev(div3, "class", "meta svelte-1a2k4ni");
			add_location(div3, file, 18, 12, 782);
			attr_dev(div4, "class", "description nowrap svelte-1a2k4ni");
			add_location(div4, file, 22, 12, 1072);
			attr_dev(div5, "class", "article svelte-1a2k4ni");
			add_location(div5, file, 11, 8, 379);
		},
		m: function mount(target, anchor) {
			insert_dev(target, div5, anchor);
			append_dev(div5, div1);
			append_dev(div1, button0);
			append_dev(button0, t0);
			append_dev(div1, t1);
			append_dev(div1, div0);
			append_dev(div0, button1);
			append_dev(div5, t3);
			append_dev(div5, div3);
			append_dev(div3, a);
			append_dev(a, img);
			append_dev(a, t4);
			append_dev(div3, t5);
			append_dev(div3, div2);
			append_dev(div2, t6);
			append_dev(div5, t7);
			append_dev(div5, div4);
			append_dev(div4, t8);
			append_dev(div5, t9);

			if (!mounted) {
				dispose = [
					listen_dev(button0, "click", click_handler, false, false, false),
					listen_dev(button1, "click", click_handler_1, false, false, false)
				];

				mounted = true;
			}
		},
		p: function update(new_ctx, dirty) {
			ctx = new_ctx;
			if (dirty & /*articles*/ 4 && t0_value !== (t0_value = /*article*/ ctx[15].title + "")) set_data_dev(t0, t0_value);

			if (dirty & /*articles*/ 4 && button0_title_value !== (button0_title_value = /*article*/ ctx[15].title)) {
				attr_dev(button0, "title", button0_title_value);
			}

			if (dirty & /*articles*/ 4 && !src_url_equal(img.src, img_src_value = getArticleFavicon(/*article*/ ctx[15]))) {
				attr_dev(img, "src", img_src_value);
			}

			if (dirty & /*articles*/ 4 && t4_value !== (t4_value = /*article*/ ctx[15].origin.title + "")) set_data_dev(t4, t4_value);

			if (dirty & /*articles*/ 4 && a_href_value !== (a_href_value = /*article*/ ctx[15].origin.htmlUrl)) {
				attr_dev(a, "href", a_href_value);
			}

			if (dirty & /*articles*/ 4 && t6_value !== (t6_value = new Date(/*article*/ ctx[15].published * 1000).toLocaleString() + "")) set_data_dev(t6, t6_value);
			if (dirty & /*articles*/ 4 && t8_value !== (t8_value = stripHtml(/*article*/ ctx[15].summary.content) + "")) set_data_dev(t8, t8_value);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(div5);
			mounted = false;
			run_all(dispose);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_each_block.name,
		type: "each",
		source: "(11:8) {#each articles as article}",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let if_block_anchor;
	let if_block = /*isMounted*/ ctx[0] && create_if_block(ctx);

	const block = {
		c: function create() {
			if (if_block) if_block.c();
			if_block_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if (if_block) if_block.m(target, anchor);
			insert_dev(target, if_block_anchor, anchor);
		},
		p: function update(ctx, [dirty]) {
			if (/*isMounted*/ ctx[0]) {
				if (if_block) {
					if_block.p(ctx, dirty);
				} else {
					if_block = create_if_block(ctx);
					if_block.c();
					if_block.m(if_block_anchor.parentNode, if_block_anchor);
				}
			} else if (if_block) {
				if_block.d(1);
				if_block = null;
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (if_block) if_block.d(detaching);
			if (detaching) detach_dev(if_block_anchor);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_fragment.name,
		type: "component",
		source: "",
		ctx
	});

	return block;
}

function stripHtml(text) {
	const elm = document.createElement("div");
	elm.innerHTML = text;
	return elm.textContent;
}

function instance($$self, $$props, $$invalidate) {
	let openArticleAction;
	let readArticleAction;
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('App', slots, []);
	let { freshRssService } = $$props;
	let { appSettingsService } = $$props;
	let { serverSettingsService } = $$props;
	let isMounted = false;
	let serverSettings = false;
	let appSettings = false;
	let articles = [];

	async function openHomepage() {
		window.open(serverSettings.url);
		window.close();
	}

	async function refreshArticles() {
		$$invalidate(2, articles = []);

		$$invalidate(2, articles = await freshRssService.getArticles({
			count: appSettings.articleCount,
			unread: true
		}));
	}

	async function openArticle(article) {
		if (appSettings.markAsRead) {
			$$invalidate(2, articles = articles.filter(x => x != article));
		}

		await openArticleAction.run(article);
	}

	async function readArticle(article) {
		await readArticleAction.run(article);
	}

	onMount(async () => {
		$$invalidate(1, serverSettings = await serverSettingsService.load());
		appSettings = await appSettingsService.load();
		refreshArticles();
		$$invalidate(0, isMounted = true);
	});

	$$self.$$.on_mount.push(function () {
		if (freshRssService === undefined && !('freshRssService' in $$props || $$self.$$.bound[$$self.$$.props['freshRssService']])) {
			console.warn("<App> was created without expected prop 'freshRssService'");
		}

		if (appSettingsService === undefined && !('appSettingsService' in $$props || $$self.$$.bound[$$self.$$.props['appSettingsService']])) {
			console.warn("<App> was created without expected prop 'appSettingsService'");
		}

		if (serverSettingsService === undefined && !('serverSettingsService' in $$props || $$self.$$.bound[$$self.$$.props['serverSettingsService']])) {
			console.warn("<App> was created without expected prop 'serverSettingsService'");
		}
	});

	const writable_props = ['freshRssService', 'appSettingsService', 'serverSettingsService'];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
	});

	const click_handler = article => openArticle(article);
	const click_handler_1 = article => readArticle(article);

	$$self.$$set = $$props => {
		if ('freshRssService' in $$props) $$invalidate(7, freshRssService = $$props.freshRssService);
		if ('appSettingsService' in $$props) $$invalidate(8, appSettingsService = $$props.appSettingsService);
		if ('serverSettingsService' in $$props) $$invalidate(9, serverSettingsService = $$props.serverSettingsService);
	};

	$$self.$capture_state = () => ({
		onMount,
		getArticleFavicon,
		OpenArticleAction,
		ReadArticleAction,
		freshRssService,
		appSettingsService,
		serverSettingsService,
		isMounted,
		serverSettings,
		appSettings,
		articles,
		openHomepage,
		refreshArticles,
		openArticle,
		readArticle,
		stripHtml,
		readArticleAction,
		openArticleAction
	});

	$$self.$inject_state = $$props => {
		if ('freshRssService' in $$props) $$invalidate(7, freshRssService = $$props.freshRssService);
		if ('appSettingsService' in $$props) $$invalidate(8, appSettingsService = $$props.appSettingsService);
		if ('serverSettingsService' in $$props) $$invalidate(9, serverSettingsService = $$props.serverSettingsService);
		if ('isMounted' in $$props) $$invalidate(0, isMounted = $$props.isMounted);
		if ('serverSettings' in $$props) $$invalidate(1, serverSettings = $$props.serverSettings);
		if ('appSettings' in $$props) appSettings = $$props.appSettings;
		if ('articles' in $$props) $$invalidate(2, articles = $$props.articles);
		if ('readArticleAction' in $$props) readArticleAction = $$props.readArticleAction;
		if ('openArticleAction' in $$props) openArticleAction = $$props.openArticleAction;
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*appSettingsService, freshRssService*/ 384) {
			openArticleAction = new OpenArticleAction(appSettingsService, freshRssService);
		}

		if ($$self.$$.dirty & /*freshRssService*/ 128) {
			readArticleAction = new ReadArticleAction(freshRssService);
		}
	};

	return [
		isMounted,
		serverSettings,
		articles,
		openHomepage,
		refreshArticles,
		openArticle,
		readArticle,
		freshRssService,
		appSettingsService,
		serverSettingsService,
		click_handler,
		click_handler_1
	];
}

class App extends SvelteComponentDev {
	constructor(options) {
		super(options);

		init(
			this,
			options,
			instance,
			create_fragment,
			safe_not_equal,
			{
				freshRssService: 7,
				appSettingsService: 8,
				serverSettingsService: 9
			},
			add_css
		);

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "App",
			options,
			id: create_fragment.name
		});
	}

	get freshRssService() {
		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set freshRssService(value) {
		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get appSettingsService() {
		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set appSettingsService(value) {
		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	get serverSettingsService() {
		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}

	set serverSettingsService(value) {
		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
	}
}var domain;

// This constructor is used to store event handlers. Instantiating this is
// faster than explicitly calling `Object.create(null)` to get a "clean" empty
// object (tested with v8 v4.9).
function EventHandlers() {}
EventHandlers.prototype = Object.create(null);

function EventEmitter() {
  EventEmitter.init.call(this);
}

// nodejs oddity
// require('events') === require('events').EventEmitter
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.usingDomains = false;

EventEmitter.prototype.domain = undefined;
EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

EventEmitter.init = function() {
  this.domain = null;
  if (EventEmitter.usingDomains) {
    // if there is an active domain, then attach to it.
    if (domain.active ) ;
  }

  if (!this._events || this._events === Object.getPrototypeOf(this)._events) {
    this._events = new EventHandlers();
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
};

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events, domain;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  domain = this.domain;

  // If there is no 'error' event listener then throw.
  if (doError) {
    er = arguments[1];
    if (domain) {
      if (!er)
        er = new Error('Uncaught, unspecified "error" event');
      er.domainEmitter = this;
      er.domain = domain;
      er.domainThrown = false;
      domain.emit('error', er);
    } else if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
    // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
    // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = new EventHandlers();
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
                  listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] = prepend ? [listener, existing] :
                                          [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' ' + type + ' listeners added. ' +
                            'Use emitter.setMaxListeners() to increase limit');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        emitWarning(w);
      }
    }
  }

  return target;
}
function emitWarning(e) {
  typeof console.warn === 'function' ? console.warn(e) : console.log(e);
}
EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function _onceWrap(target, type, listener) {
  var fired = false;
  function g() {
    target.removeListener(type, g);
    if (!fired) {
      fired = true;
      listener.apply(target, arguments);
    }
  }
  g.listener = listener;
  return g;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || (list.listener && list.listener === listener)) {
        if (--this._eventsCount === 0)
          this._events = new EventHandlers();
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length; i-- > 0;) {
          if (list[i] === listener ||
              (list[i].listener && list[i].listener === listener)) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (list.length === 1) {
          list[0] = undefined;
          if (--this._eventsCount === 0) {
            this._events = new EventHandlers();
            return this;
          } else {
            delete events[type];
          }
        } else {
          spliceOne(list, position);
        }

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };
    
// Alias for removeListener added in NodeJS 10.0
// https://nodejs.org/api/events.html#events_emitter_off_eventname_listener
EventEmitter.prototype.off = function(type, listener){
    return this.removeListener(type, listener);
};

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = new EventHandlers();
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = new EventHandlers();
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = Object.keys(events);
        for (var i = 0, key; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = new EventHandlers();
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        do {
          this.removeListener(type, listeners[listeners.length - 1]);
        } while (listeners[0]);
      }

      return this;
    };

EventEmitter.prototype.listeners = function listeners(type) {
  var evlistener;
  var ret;
  var events = this._events;

  if (!events)
    ret = [];
  else {
    evlistener = events[type];
    if (!evlistener)
      ret = [];
    else if (typeof evlistener === 'function')
      ret = [evlistener.listener || evlistener];
    else
      ret = unwrapListeners(evlistener);
  }

  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, i) {
  var copy = new Array(i);
  while (i--)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}class BaseSettingsService extends EventEmitter {

    constructor(key) {
        super();
        this.key = key;

        browser.storage.onChanged.addListener((changes, areaName) => {
            if (areaName != "local") return;
            if (!(this.key in changes)) return;
            this.emit("update", changes[this.key]);
        });
    }

    async load() {
        return (await browser.storage.local.get({ [this.key]: {
            url: "localhost",
            auth: {
                username: "admin",
                apiPassword: "test"
            }
        }}))[this.key];
    }

    async save(settings) {
        await browser.storage.local.set({ [this.key]: settings });
    }

}class ApplicationSettingsService extends BaseSettingsService {

    constructor() {
        super("application");
    }

}class ServerSettingsService extends BaseSettingsService {

    constructor() {
        super("server");
    }

}const tags = {
    read: "user/-/state/com.google/read",
    star: "user/-/state/com.google/starred"
};

class FreshRssService {

    constructor(serverSettingsService) {
        this.serverSettingsService = serverSettingsService;
        this.reset();
        this.serverSettingsService.addListener("change", () => this.reset());
    }

    reset() {
        this.options = null;
        this.auth = null;
        this.token = null;
    }

    get baseUrl() {
        return `${this.options.url}/api/greader.php`;
    }

    get authUrl() {
        return `${this.baseUrl}/accounts/ClientLogin?Email=${encodeURIComponent(this.options.auth.username)}&Passwd=${encodeURIComponent(this.options.auth.apiPassword)}`;
    }

    async testConnection() {
        await this.initialize();

        const response = await fetch(this.baseUrl);

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText
        };
    }

    async testAuthentication() {
        await this.initialize();

        const response = await fetch(this.authUrl);
        const val = this.getAuthValue(await response.text());

        return {
            success: response.ok && val,
            status: response.status,
            statusText: response.statusText
        };
    }

    async initialize() {
        if (this.options == null) {
            this.options = await this.serverSettingsService.load();
        }
    }

    async authenticate() {
        await this.initialize();

        if (this.auth == null) {
            const response = await fetch(this.authUrl);
            this.auth = this.getAuthValue(await response.text());
        }
    }

    async authenticateToken() {
        await this.authenticate();

        if (this.token == null) {
            const requestUrl = `${this.baseUrl}/reader/api/0/token`;
            const response = await fetch(requestUrl, { headers: this.getAuthHeaders() });
            const text = await response.text();
            this.token = text.trim();
        }
    }

    async getArticles(options) {
        await this.authenticate();

        const requestParams = new URLSearchParams();
        if (options.count) requestParams.append("n", options.count);
        if (options.unread) requestParams.append("xt", tags.read);
        if (options.startDate) requestParams.append("ot", Math.round(options.startDate.getTime() / 1000));
        if (options.endDate) requestParams.append("nt", Math.round(options.endDate.getTime() / 1000));

        const requestUrl = `${this.baseUrl}/reader/api/0/stream/contents/reading-list?${requestParams.toString()}`;
        const response = await fetch(requestUrl, { headers: this.getAuthHeaders() });
        const json = await response.json();
        return json.items;
    }

    async markArticleAsRead(articleId) {
        await this.authenticateToken();

        const body = new URLSearchParams();
        body.append("a", tags.read);
        body.append("i", articleId);
        body.append("T", this.token);

        const requestUrl = `${this.baseUrl}/reader/api/0/edit-tag`;
        const response = await fetch(requestUrl, { method: "POST", headers: this.getAuthHeaders(), body });
        return response.ok;
    }

    async getUnreadCount() {
        await this.authenticate();
        const requestUrl = `${this.baseUrl}/reader/api/0/unread-count?output=json`;
        const response = await fetch(requestUrl, { headers: this.getAuthHeaders() });
        const json = await response.json();
        return json.max;
    }

    getAuthValue(text) {
        const lines = text.split('\n');
        const auth = lines.find(x => x.startsWith("Auth="));
        const val = auth.split("=", 2);
        return val[1];
    }

    getAuthHeaders() {
        return {
            "Authorization": `GoogleLogin auth=${this.auth}`
        }
    }

}const appSettingsService = new ApplicationSettingsService();
const serverSettingsService = new ServerSettingsService();
const freshRssService = new FreshRssService(serverSettingsService);

new App({ 
    target: document.body,
    props: {
        appSettingsService,
        serverSettingsService,
        freshRssService
    }
});
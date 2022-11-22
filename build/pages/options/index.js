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
function to_number(value) {
    return value === '' ? null : +value;
}
function children(element) {
    return Array.from(element.childNodes);
}
function set_input_value(input, value) {
    input.value = value == null ? '' : value;
}
function set_style(node, key, value, important) {
    if (value === null) {
        node.style.removeProperty(key);
    }
    else {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
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
}class SettingsApi {

    constructor() {
    }

    async loadServerSettings() {
        return (await browser.storage.local.get({ "server": {
            url: "localhost",
            auth: {
                username: "admin",
                apiPassword: "test"
            }
        }})).server;
    }

    async saveServerSettings(settings) {
        await browser.storage.local.set({ "server": settings });
    }

    async loadAppSettings() {
        return (await browser.storage.local.get({ "application": {
            pollingInterval: 10,
            articleCount: 20,
            markAsRead: true
        }})).application;
    }

    async saveAppSettings(settings) {
        await browser.storage.local.set({ "application": settings });
    }

}const tags = {
    read: "user/-/state/com.google/read",
    star: "user/-/state/com.google/starred"
};

class FreshRssApi {

    constructor(options) {
        this.options = options;
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
        const response = await fetch(this.baseUrl);

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText
        };
    }

    async testAuthentication() {
        const response = await fetch(this.authUrl);
        const val = this.getAuthValue(await response.text());

        return {
            success: response.ok && val,
            status: response.status,
            statusText: response.statusText
        };
    }

    async authenticate() {
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

}/* src\pages\options\App.svelte generated by Svelte v3.53.1 */
const file = "src\\pages\\options\\App.svelte";

function add_css(target) {
	append_styles(target, "svelte-102d4we", "h1.svelte-102d4we{margin:0;padding:0.25em 0}.form.svelte-102d4we{display:flex;flex-direction:column}.field.svelte-102d4we{display:flex;flex-direction:row;align-items:center;padding:0.25em 0}.field-label.svelte-102d4we{flex:0 0 10em}.field-value.svelte-102d4we{flex:1 1 auto}\n/*# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQXBwLnN2ZWx0ZSIsInNvdXJjZXMiOlsiQXBwLnN2ZWx0ZSJdLCJzb3VyY2VzQ29udGVudCI6WyJ7I2lmIHNlcnZlclNldHRpbmdzfVxyXG5cclxuPGgxPlNlcnZlcjwvaDE+XHJcblxyXG48ZGl2IGNsYXNzPVwiZm9ybVwiPlxyXG5cclxuICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkLWxhYmVsXCI+VVJMPC9kaXY+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkLXZhbHVlXCI+PGlucHV0IGJpbmQ6dmFsdWU9e3NlcnZlclNldHRpbmdzLnVybH0gc3R5bGU9XCJ3aWR0aDogOTAlO1wiIC8+PC9kaXY+XHJcbiAgICA8L2xhYmVsPlxyXG5cclxuICAgIDxsYWJlbCBjbGFzcz1cImZpZWxkXCI+XHJcbiAgICAgICAgPGRpdiBjbGFzcz1cImZpZWxkLWxhYmVsXCI+PGJ1dHRvbiBvbjpjbGljaz17dGVzdENvbm5lY3Rpb259PlRlc3QgQ29ubmVjdGlvbjwvYnV0dG9uPjwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC12YWx1ZVwiPntjb25uZWN0aW9uU3RhdHVzfTwvZGl2PlxyXG4gICAgPC9sYWJlbD5cclxuXHJcbjwvZGl2PlxyXG5cclxuPGgxPkF1dGhlbnRpY2F0aW9uPC9oMT5cclxuXHJcbjxkaXYgY2xhc3M9XCJmb3JtXCI+XHJcblxyXG4gICAgPGxhYmVsIGNsYXNzPVwiZmllbGRcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtbGFiZWxcIj5Vc2VybmFtZTwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC12YWx1ZVwiPjxpbnB1dCBiaW5kOnZhbHVlPXtzZXJ2ZXJTZXR0aW5ncy5hdXRoLnVzZXJuYW1lfSAvPjwvZGl2PlxyXG4gICAgPC9sYWJlbD5cclxuXHJcbiAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZFwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkFQSSBQYXNzd29yZDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC12YWx1ZVwiPjxpbnB1dCBiaW5kOnZhbHVlPXtzZXJ2ZXJTZXR0aW5ncy5hdXRoLmFwaVBhc3N3b3JkfSB0eXBlPVwicGFzc3dvcmRcIiAvPjwvZGl2PlxyXG4gICAgPC9sYWJlbD5cclxuXHJcbiAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZFwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPjxidXR0b24gb246Y2xpY2s9e3Rlc3RMb2dpbn0+VGVzdCBMb2dpbjwvYnV0dG9uPjwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC12YWx1ZVwiPntsb2dpblN0YXR1c308L2Rpdj5cclxuICAgIDwvbGFiZWw+XHJcblxyXG48L2Rpdj5cclxuXHJcbnsvaWZ9XHJcblxyXG57I2lmIGFwcFNldHRpbmdzfVxyXG5cclxuPGgxPk5vdGlmaWNhdGlvbnM8L2gxPlxyXG5cclxuPGRpdiBjbGFzcz1cImZvcm1cIj5cclxuXHJcbiAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZFwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPlBvbGxpbmcgSW50ZXJ2YWw8L2Rpdj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtdmFsdWVcIj48aW5wdXQgYmluZDp2YWx1ZT17YXBwU2V0dGluZ3MucG9sbGluZ0ludGVydmFsfSB0eXBlPVwibnVtYmVyXCIgbWluPTUgLz4gbWludXRlczwvZGl2PlxyXG4gICAgPC9sYWJlbD5cclxuXHJcbiAgICA8bGFiZWwgY2xhc3M9XCJmaWVsZFwiPlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC1sYWJlbFwiPkFydGljbGUgQ291bnQ8L2Rpdj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtdmFsdWVcIj48aW5wdXQgYmluZDp2YWx1ZT17YXBwU2V0dGluZ3MuYXJ0aWNsZUNvdW50fSB0eXBlPVwibnVtYmVyXCIgLz48L2Rpdj5cclxuICAgIDwvbGFiZWw+XHJcblxyXG4gICAgPGxhYmVsIGNsYXNzPVwiZmllbGRcIj5cclxuICAgICAgICA8ZGl2IGNsYXNzPVwiZmllbGQtbGFiZWxcIj5NYXJrIGFydGljbGUgYXMgcmVhZCB3aGVuIG9wZW5lZDwvZGl2PlxyXG4gICAgICAgIDxkaXYgY2xhc3M9XCJmaWVsZC12YWx1ZVwiPjxpbnB1dCBiaW5kOmNoZWNrZWQ9e2FwcFNldHRpbmdzLm1hcmtBc1JlYWR9IHR5cGU9XCJjaGVja2JveFwiIC8+PC9kaXY+XHJcbiAgICA8L2xhYmVsPlxyXG5cclxuPC9kaXY+XHJcblxyXG57L2lmfVxyXG5cclxuPHN0eWxlPlxyXG4gICAgXHJcbiAgICBoMSB7XHJcbiAgICAgICAgbWFyZ2luOiAwO1xyXG4gICAgICAgIHBhZGRpbmc6IDAuMjVlbSAwO1xyXG4gICAgfVxyXG5cclxuICAgIC5mb3JtIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47XHJcbiAgICB9XHJcblxyXG4gICAgLmZpZWxkIHtcclxuICAgICAgICBkaXNwbGF5OiBmbGV4O1xyXG4gICAgICAgIGZsZXgtZGlyZWN0aW9uOiByb3c7XHJcbiAgICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcclxuICAgICAgICBwYWRkaW5nOiAwLjI1ZW0gMDtcclxuICAgIH1cclxuXHJcbiAgICAuZmllbGQtbGFiZWwge1xyXG4gICAgICAgIGZsZXg6IDAgMCAxMGVtO1xyXG4gICAgfVxyXG5cclxuICAgIC5maWVsZC12YWx1ZSB7XHJcbiAgICAgICAgZmxleDogMSAxIGF1dG87XHJcbiAgICB9XHJcblxyXG5cclxuPC9zdHlsZT5cclxuXHJcbjxzY3JpcHQ+XHJcblxyXG4gICAgaW1wb3J0IHsgb25Nb3VudCB9IGZyb20gJ3N2ZWx0ZSc7XHJcbiAgICBpbXBvcnQgU2V0dGluZ3NBcGkgZnJvbSAnLi4vLi4vc2hhcmVkL1NldHRpbmdzQXBpJztcclxuICAgIGltcG9ydCBGcmVzaFJzc0FwaSBmcm9tICcuLi8uLi9zaGFyZWQvRnJlc2hSc3NBcGknO1xyXG5cclxuICAgIGNvbnN0IHNldHRpbmdzQXBpID0gbmV3IFNldHRpbmdzQXBpKCk7XHJcblxyXG4gICAgbGV0IHNlcnZlclNldHRpbmdzID0gZmFsc2U7XHJcbiAgICBsZXQgYXBwU2V0dGluZ3MgPSBmYWxzZTtcclxuXHJcbiAgICBsZXQgY29ubmVjdGlvblN0YXR1cyA9IFwiXCI7XHJcbiAgICBsZXQgbG9naW5TdGF0dXMgPSBcIlwiO1xyXG5cclxuICAgICQ6IHNlcnZlclNldHRpbmdzICYmIHNldHRpbmdzQXBpLnNhdmVTZXJ2ZXJTZXR0aW5ncyhzZXJ2ZXJTZXR0aW5ncyk7XHJcbiAgICAkOiBhcHBTZXR0aW5ncyAmJiBzZXR0aW5nc0FwaS5zYXZlQXBwU2V0dGluZ3MoYXBwU2V0dGluZ3MpO1xyXG5cclxuICAgIGFzeW5jIGZ1bmN0aW9uIHRlc3RDb25uZWN0aW9uKCkge1xyXG4gICAgICAgIGNvbm5lY3Rpb25TdGF0dXMgPSBcIlRlc3RpbmcuLi5cIjtcclxuICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBuZXcgRnJlc2hSc3NBcGkoc2VydmVyU2V0dGluZ3MpLnRlc3RDb25uZWN0aW9uKCk7XHJcbiAgICAgICAgY29uc3Qgc3RhdHVzID0gcmVzdWx0LnN1Y2Nlc3MgPyBcIlBhc3NcIiA6IFwiRXJyb3JcIjtcclxuICAgICAgICBjb25uZWN0aW9uU3RhdHVzID0gYCR7c3RhdHVzfTogJHtyZXN1bHQuc3RhdHVzfSAke3Jlc3VsdC5zdGF0dXNUZXh0fWA7XHJcbiAgICB9O1xyXG5cclxuICAgIGFzeW5jIGZ1bmN0aW9uIHRlc3RMb2dpbigpIHtcclxuICAgICAgICBsb2dpblN0YXR1cyA9IFwiVGVzdGluZy4uLlwiO1xyXG4gICAgICAgIGNvbnN0IHJlc3VsdCA9IGF3YWl0IG5ldyBGcmVzaFJzc0FwaShzZXJ2ZXJTZXR0aW5ncykudGVzdEF1dGhlbnRpY2F0aW9uKCk7XHJcbiAgICAgICAgY29uc3Qgc3RhdHVzID0gcmVzdWx0LnN1Y2Nlc3MgPyBcIlBhc3NcIjogXCJFcnJvclwiO1xyXG4gICAgICAgIGxvZ2luU3RhdHVzID0gYCR7c3RhdHVzfTogJHtyZXN1bHQuc3RhdHVzfSAke3Jlc3VsdC5zdGF0dXNUZXh0fWA7XHJcbiAgICB9XHJcblxyXG4gICAgb25Nb3VudChhc3luYyAoKSA9PiB7XHJcbiAgICAgICAgc2VydmVyU2V0dGluZ3MgPSBhd2FpdCBzZXR0aW5nc0FwaS5sb2FkU2VydmVyU2V0dGluZ3MoKTtcclxuICAgICAgICBhcHBTZXR0aW5ncyA9IGF3YWl0IHNldHRpbmdzQXBpLmxvYWRBcHBTZXR0aW5ncygpO1xyXG4gICAgfSk7XHJcblxyXG48L3NjcmlwdD4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBb0VJLEVBQUUsZUFBQyxDQUFDLEFBQ0EsTUFBTSxDQUFFLENBQUMsQ0FDVCxPQUFPLENBQUUsTUFBTSxDQUFDLENBQUMsQUFDckIsQ0FBQyxBQUVELEtBQUssZUFBQyxDQUFDLEFBQ0gsT0FBTyxDQUFFLElBQUksQ0FDYixjQUFjLENBQUUsTUFBTSxBQUMxQixDQUFDLEFBRUQsTUFBTSxlQUFDLENBQUMsQUFDSixPQUFPLENBQUUsSUFBSSxDQUNiLGNBQWMsQ0FBRSxHQUFHLENBQ25CLFdBQVcsQ0FBRSxNQUFNLENBQ25CLE9BQU8sQ0FBRSxNQUFNLENBQUMsQ0FBQyxBQUNyQixDQUFDLEFBRUQsWUFBWSxlQUFDLENBQUMsQUFDVixJQUFJLENBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLEFBQ2xCLENBQUMsQUFFRCxZQUFZLGVBQUMsQ0FBQyxBQUNWLElBQUksQ0FBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQUFDbEIsQ0FBQyJ9 */");
}

// (1:0) {#if serverSettings}
function create_if_block_1(ctx) {
	let h10;
	let t1;
	let div4;
	let label0;
	let div0;
	let t3;
	let div1;
	let input0;
	let t4;
	let label1;
	let div2;
	let button0;
	let t6;
	let div3;
	let t7;
	let t8;
	let h11;
	let t10;
	let div11;
	let label2;
	let div5;
	let t12;
	let div6;
	let input1;
	let t13;
	let label3;
	let div7;
	let t15;
	let div8;
	let input2;
	let t16;
	let label4;
	let div9;
	let button1;
	let t18;
	let div10;
	let t19;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			h10 = element("h1");
			h10.textContent = "Server";
			t1 = space();
			div4 = element("div");
			label0 = element("label");
			div0 = element("div");
			div0.textContent = "URL";
			t3 = space();
			div1 = element("div");
			input0 = element("input");
			t4 = space();
			label1 = element("label");
			div2 = element("div");
			button0 = element("button");
			button0.textContent = "Test Connection";
			t6 = space();
			div3 = element("div");
			t7 = text(/*connectionStatus*/ ctx[2]);
			t8 = space();
			h11 = element("h1");
			h11.textContent = "Authentication";
			t10 = space();
			div11 = element("div");
			label2 = element("label");
			div5 = element("div");
			div5.textContent = "Username";
			t12 = space();
			div6 = element("div");
			input1 = element("input");
			t13 = space();
			label3 = element("label");
			div7 = element("div");
			div7.textContent = "API Password";
			t15 = space();
			div8 = element("div");
			input2 = element("input");
			t16 = space();
			label4 = element("label");
			div9 = element("div");
			button1 = element("button");
			button1.textContent = "Test Login";
			t18 = space();
			div10 = element("div");
			t19 = text(/*loginStatus*/ ctx[3]);
			attr_dev(h10, "class", "svelte-102d4we");
			add_location(h10, file, 2, 0, 24);
			attr_dev(div0, "class", "field-label svelte-102d4we");
			add_location(div0, file, 7, 8, 100);
			set_style(input0, "width", "90%");
			add_location(input0, file, 8, 33, 169);
			attr_dev(div1, "class", "field-value svelte-102d4we");
			add_location(div1, file, 8, 8, 144);
			attr_dev(label0, "class", "field svelte-102d4we");
			add_location(label0, file, 6, 4, 69);
			add_location(button0, file, 12, 33, 314);
			attr_dev(div2, "class", "field-label svelte-102d4we");
			add_location(div2, file, 12, 8, 289);
			attr_dev(div3, "class", "field-value svelte-102d4we");
			add_location(div3, file, 13, 8, 388);
			attr_dev(label1, "class", "field svelte-102d4we");
			add_location(label1, file, 11, 4, 258);
			attr_dev(div4, "class", "form svelte-102d4we");
			add_location(div4, file, 4, 0, 43);
			attr_dev(h11, "class", "svelte-102d4we");
			add_location(h11, file, 18, 0, 465);
			attr_dev(div5, "class", "field-label svelte-102d4we");
			add_location(div5, file, 23, 8, 549);
			add_location(input1, file, 24, 33, 623);
			attr_dev(div6, "class", "field-value svelte-102d4we");
			add_location(div6, file, 24, 8, 598);
			attr_dev(label2, "class", "field svelte-102d4we");
			add_location(label2, file, 22, 4, 518);
			attr_dev(div7, "class", "field-label svelte-102d4we");
			add_location(div7, file, 28, 8, 733);
			attr_dev(input2, "type", "password");
			add_location(input2, file, 29, 33, 811);
			attr_dev(div8, "class", "field-value svelte-102d4we");
			add_location(div8, file, 29, 8, 786);
			attr_dev(label3, "class", "field svelte-102d4we");
			add_location(label3, file, 27, 4, 702);
			add_location(button1, file, 33, 33, 965);
			attr_dev(div9, "class", "field-label svelte-102d4we");
			add_location(div9, file, 33, 8, 940);
			attr_dev(div10, "class", "field-value svelte-102d4we");
			add_location(div10, file, 34, 8, 1029);
			attr_dev(label4, "class", "field svelte-102d4we");
			add_location(label4, file, 32, 4, 909);
			attr_dev(div11, "class", "form svelte-102d4we");
			add_location(div11, file, 20, 0, 492);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h10, anchor);
			insert_dev(target, t1, anchor);
			insert_dev(target, div4, anchor);
			append_dev(div4, label0);
			append_dev(label0, div0);
			append_dev(label0, t3);
			append_dev(label0, div1);
			append_dev(div1, input0);
			set_input_value(input0, /*serverSettings*/ ctx[0].url);
			append_dev(div4, t4);
			append_dev(div4, label1);
			append_dev(label1, div2);
			append_dev(div2, button0);
			append_dev(label1, t6);
			append_dev(label1, div3);
			append_dev(div3, t7);
			insert_dev(target, t8, anchor);
			insert_dev(target, h11, anchor);
			insert_dev(target, t10, anchor);
			insert_dev(target, div11, anchor);
			append_dev(div11, label2);
			append_dev(label2, div5);
			append_dev(label2, t12);
			append_dev(label2, div6);
			append_dev(div6, input1);
			set_input_value(input1, /*serverSettings*/ ctx[0].auth.username);
			append_dev(div11, t13);
			append_dev(div11, label3);
			append_dev(label3, div7);
			append_dev(label3, t15);
			append_dev(label3, div8);
			append_dev(div8, input2);
			set_input_value(input2, /*serverSettings*/ ctx[0].auth.apiPassword);
			append_dev(div11, t16);
			append_dev(div11, label4);
			append_dev(label4, div9);
			append_dev(div9, button1);
			append_dev(label4, t18);
			append_dev(label4, div10);
			append_dev(div10, t19);

			if (!mounted) {
				dispose = [
					listen_dev(input0, "input", /*input0_input_handler*/ ctx[6]),
					listen_dev(button0, "click", /*testConnection*/ ctx[4], false, false, false),
					listen_dev(input1, "input", /*input1_input_handler*/ ctx[7]),
					listen_dev(input2, "input", /*input2_input_handler*/ ctx[8]),
					listen_dev(button1, "click", /*testLogin*/ ctx[5], false, false, false)
				];

				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*serverSettings*/ 1 && input0.value !== /*serverSettings*/ ctx[0].url) {
				set_input_value(input0, /*serverSettings*/ ctx[0].url);
			}

			if (dirty & /*connectionStatus*/ 4) set_data_dev(t7, /*connectionStatus*/ ctx[2]);

			if (dirty & /*serverSettings*/ 1 && input1.value !== /*serverSettings*/ ctx[0].auth.username) {
				set_input_value(input1, /*serverSettings*/ ctx[0].auth.username);
			}

			if (dirty & /*serverSettings*/ 1 && input2.value !== /*serverSettings*/ ctx[0].auth.apiPassword) {
				set_input_value(input2, /*serverSettings*/ ctx[0].auth.apiPassword);
			}

			if (dirty & /*loginStatus*/ 8) set_data_dev(t19, /*loginStatus*/ ctx[3]);
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h10);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(div4);
			if (detaching) detach_dev(t8);
			if (detaching) detach_dev(h11);
			if (detaching) detach_dev(t10);
			if (detaching) detach_dev(div11);
			mounted = false;
			run_all(dispose);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block_1.name,
		type: "if",
		source: "(1:0) {#if serverSettings}",
		ctx
	});

	return block;
}

// (42:0) {#if appSettings}
function create_if_block(ctx) {
	let h1;
	let t1;
	let div6;
	let label0;
	let div0;
	let t3;
	let div1;
	let input0;
	let t4;
	let t5;
	let label1;
	let div2;
	let t7;
	let div3;
	let input1;
	let t8;
	let label2;
	let div4;
	let t10;
	let div5;
	let input2;
	let mounted;
	let dispose;

	const block = {
		c: function create() {
			h1 = element("h1");
			h1.textContent = "Notifications";
			t1 = space();
			div6 = element("div");
			label0 = element("label");
			div0 = element("div");
			div0.textContent = "Polling Interval";
			t3 = space();
			div1 = element("div");
			input0 = element("input");
			t4 = text(" minutes");
			t5 = space();
			label1 = element("label");
			div2 = element("div");
			div2.textContent = "Article Count";
			t7 = space();
			div3 = element("div");
			input1 = element("input");
			t8 = space();
			label2 = element("label");
			div4 = element("div");
			div4.textContent = "Mark article as read when opened";
			t10 = space();
			div5 = element("div");
			input2 = element("input");
			attr_dev(h1, "class", "svelte-102d4we");
			add_location(h1, file, 43, 0, 1131);
			attr_dev(div0, "class", "field-label svelte-102d4we");
			add_location(div0, file, 48, 8, 1214);
			attr_dev(input0, "type", "number");
			attr_dev(input0, "min", "5");
			add_location(input0, file, 49, 33, 1296);
			attr_dev(div1, "class", "field-value svelte-102d4we");
			add_location(div1, file, 49, 8, 1271);
			attr_dev(label0, "class", "field svelte-102d4we");
			add_location(label0, file, 47, 4, 1183);
			attr_dev(div2, "class", "field-label svelte-102d4we");
			add_location(div2, file, 53, 8, 1433);
			attr_dev(input1, "type", "number");
			add_location(input1, file, 54, 33, 1512);
			attr_dev(div3, "class", "field-value svelte-102d4we");
			add_location(div3, file, 54, 8, 1487);
			attr_dev(label1, "class", "field svelte-102d4we");
			add_location(label1, file, 52, 4, 1402);
			attr_dev(div4, "class", "field-label svelte-102d4we");
			add_location(div4, file, 58, 8, 1632);
			attr_dev(input2, "type", "checkbox");
			add_location(input2, file, 59, 33, 1730);
			attr_dev(div5, "class", "field-value svelte-102d4we");
			add_location(div5, file, 59, 8, 1705);
			attr_dev(label2, "class", "field svelte-102d4we");
			add_location(label2, file, 57, 4, 1601);
			attr_dev(div6, "class", "form svelte-102d4we");
			add_location(div6, file, 45, 0, 1157);
		},
		m: function mount(target, anchor) {
			insert_dev(target, h1, anchor);
			insert_dev(target, t1, anchor);
			insert_dev(target, div6, anchor);
			append_dev(div6, label0);
			append_dev(label0, div0);
			append_dev(label0, t3);
			append_dev(label0, div1);
			append_dev(div1, input0);
			set_input_value(input0, /*appSettings*/ ctx[1].pollingInterval);
			append_dev(div1, t4);
			append_dev(div6, t5);
			append_dev(div6, label1);
			append_dev(label1, div2);
			append_dev(label1, t7);
			append_dev(label1, div3);
			append_dev(div3, input1);
			set_input_value(input1, /*appSettings*/ ctx[1].articleCount);
			append_dev(div6, t8);
			append_dev(div6, label2);
			append_dev(label2, div4);
			append_dev(label2, t10);
			append_dev(label2, div5);
			append_dev(div5, input2);
			input2.checked = /*appSettings*/ ctx[1].markAsRead;

			if (!mounted) {
				dispose = [
					listen_dev(input0, "input", /*input0_input_handler_1*/ ctx[9]),
					listen_dev(input1, "input", /*input1_input_handler_1*/ ctx[10]),
					listen_dev(input2, "change", /*input2_change_handler*/ ctx[11])
				];

				mounted = true;
			}
		},
		p: function update(ctx, dirty) {
			if (dirty & /*appSettings*/ 2 && to_number(input0.value) !== /*appSettings*/ ctx[1].pollingInterval) {
				set_input_value(input0, /*appSettings*/ ctx[1].pollingInterval);
			}

			if (dirty & /*appSettings*/ 2 && to_number(input1.value) !== /*appSettings*/ ctx[1].articleCount) {
				set_input_value(input1, /*appSettings*/ ctx[1].articleCount);
			}

			if (dirty & /*appSettings*/ 2) {
				input2.checked = /*appSettings*/ ctx[1].markAsRead;
			}
		},
		d: function destroy(detaching) {
			if (detaching) detach_dev(h1);
			if (detaching) detach_dev(t1);
			if (detaching) detach_dev(div6);
			mounted = false;
			run_all(dispose);
		}
	};

	dispatch_dev("SvelteRegisterBlock", {
		block,
		id: create_if_block.name,
		type: "if",
		source: "(42:0) {#if appSettings}",
		ctx
	});

	return block;
}

function create_fragment(ctx) {
	let t;
	let if_block1_anchor;
	let if_block0 = /*serverSettings*/ ctx[0] && create_if_block_1(ctx);
	let if_block1 = /*appSettings*/ ctx[1] && create_if_block(ctx);

	const block = {
		c: function create() {
			if (if_block0) if_block0.c();
			t = space();
			if (if_block1) if_block1.c();
			if_block1_anchor = empty();
		},
		l: function claim(nodes) {
			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
		},
		m: function mount(target, anchor) {
			if (if_block0) if_block0.m(target, anchor);
			insert_dev(target, t, anchor);
			if (if_block1) if_block1.m(target, anchor);
			insert_dev(target, if_block1_anchor, anchor);
		},
		p: function update(ctx, [dirty]) {
			if (/*serverSettings*/ ctx[0]) {
				if (if_block0) {
					if_block0.p(ctx, dirty);
				} else {
					if_block0 = create_if_block_1(ctx);
					if_block0.c();
					if_block0.m(t.parentNode, t);
				}
			} else if (if_block0) {
				if_block0.d(1);
				if_block0 = null;
			}

			if (/*appSettings*/ ctx[1]) {
				if (if_block1) {
					if_block1.p(ctx, dirty);
				} else {
					if_block1 = create_if_block(ctx);
					if_block1.c();
					if_block1.m(if_block1_anchor.parentNode, if_block1_anchor);
				}
			} else if (if_block1) {
				if_block1.d(1);
				if_block1 = null;
			}
		},
		i: noop,
		o: noop,
		d: function destroy(detaching) {
			if (if_block0) if_block0.d(detaching);
			if (detaching) detach_dev(t);
			if (if_block1) if_block1.d(detaching);
			if (detaching) detach_dev(if_block1_anchor);
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

function instance($$self, $$props, $$invalidate) {
	let { $$slots: slots = {}, $$scope } = $$props;
	validate_slots('App', slots, []);
	const settingsApi = new SettingsApi();
	let serverSettings = false;
	let appSettings = false;
	let connectionStatus = "";
	let loginStatus = "";

	async function testConnection() {
		$$invalidate(2, connectionStatus = "Testing...");
		const result = await new FreshRssApi(serverSettings).testConnection();
		const status = result.success ? "Pass" : "Error";
		$$invalidate(2, connectionStatus = `${status}: ${result.status} ${result.statusText}`);
	}

	async function testLogin() {
		$$invalidate(3, loginStatus = "Testing...");
		const result = await new FreshRssApi(serverSettings).testAuthentication();
		const status = result.success ? "Pass" : "Error";
		$$invalidate(3, loginStatus = `${status}: ${result.status} ${result.statusText}`);
	}

	onMount(async () => {
		$$invalidate(0, serverSettings = await settingsApi.loadServerSettings());
		$$invalidate(1, appSettings = await settingsApi.loadAppSettings());
	});

	const writable_props = [];

	Object.keys($$props).forEach(key => {
		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
	});

	function input0_input_handler() {
		serverSettings.url = this.value;
		$$invalidate(0, serverSettings);
	}

	function input1_input_handler() {
		serverSettings.auth.username = this.value;
		$$invalidate(0, serverSettings);
	}

	function input2_input_handler() {
		serverSettings.auth.apiPassword = this.value;
		$$invalidate(0, serverSettings);
	}

	function input0_input_handler_1() {
		appSettings.pollingInterval = to_number(this.value);
		$$invalidate(1, appSettings);
	}

	function input1_input_handler_1() {
		appSettings.articleCount = to_number(this.value);
		$$invalidate(1, appSettings);
	}

	function input2_change_handler() {
		appSettings.markAsRead = this.checked;
		$$invalidate(1, appSettings);
	}

	$$self.$capture_state = () => ({
		onMount,
		SettingsApi,
		FreshRssApi,
		settingsApi,
		serverSettings,
		appSettings,
		connectionStatus,
		loginStatus,
		testConnection,
		testLogin
	});

	$$self.$inject_state = $$props => {
		if ('serverSettings' in $$props) $$invalidate(0, serverSettings = $$props.serverSettings);
		if ('appSettings' in $$props) $$invalidate(1, appSettings = $$props.appSettings);
		if ('connectionStatus' in $$props) $$invalidate(2, connectionStatus = $$props.connectionStatus);
		if ('loginStatus' in $$props) $$invalidate(3, loginStatus = $$props.loginStatus);
	};

	if ($$props && "$$inject" in $$props) {
		$$self.$inject_state($$props.$$inject);
	}

	$$self.$$.update = () => {
		if ($$self.$$.dirty & /*serverSettings*/ 1) {
			serverSettings && settingsApi.saveServerSettings(serverSettings);
		}

		if ($$self.$$.dirty & /*appSettings*/ 2) {
			appSettings && settingsApi.saveAppSettings(appSettings);
		}
	};

	return [
		serverSettings,
		appSettings,
		connectionStatus,
		loginStatus,
		testConnection,
		testLogin,
		input0_input_handler,
		input1_input_handler,
		input2_input_handler,
		input0_input_handler_1,
		input1_input_handler_1,
		input2_change_handler
	];
}

class App extends SvelteComponentDev {
	constructor(options) {
		super(options);
		init(this, options, instance, create_fragment, safe_not_equal, {}, add_css);

		dispatch_dev("SvelteRegisterComponent", {
			component: this,
			tagName: "App",
			options,
			id: create_fragment.name
		});
	}
}new App({ target: document.body });
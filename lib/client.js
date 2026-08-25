/**
 * dsh-trace-collapse — Client half (static bundle).
 *
 * A real browser script loaded through the client module system
 * (`window.__ModuleLoader__.load`), NOT a dynamic-plugin sandbox body: it
 * receives `require` (the module table) and runs with browser globals
 * (`document`, `localStorage`, `MutationObserver`, `requestAnimationFrame`)
 * available. The module table's `react` seed supplies React.
 *
 * Feature (per-turn, restrained):
 * - The chat view renders every flow node as `[data-chat-flow-kind="..."]`
 *   inside `[data-chat-flow]`. The "agent trace" is the intermediate
 *   work of one turn: tool calls, thinking steps, steering, workflow runs,
 *   context-injection rows, etc.
 * - A small toggle sits at the TOP of each completed turn's agent output
 *   (right before the first trace node). Clicking it collapses or
 *   expands that turn's trace; the user message, the FINAL assistant
 *   output, and the completed-turn footer always stay visible.
 * - A settings row (`settings.general.item`) exposes "Collapse agent trace
 *   by default after final output" (default-collapse after the final output
 *   completes) — default
 *   ON, persisted in localStorage. When it is on, each completed turn
 *   auto-collapses; per-turn toggles still override it.
 *
 * Styling follows the shipped client-bundle pattern: a `<style>` element
 * tagged with this plugin's id.
 */
window.__ModuleLoader__.load({
  id: 'dsh-trace-collapse',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    // ── CSS — injected once, tagged for the module system's style bookkeeping ──
    var STYLE_TAG = 'dsh-trace-collapse/plugin.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + STYLE_TAG + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-trace-collapse'
      tag.dataset.pluginCss = STYLE_TAG
      tag.textContent = [
        // Hide trace nodes marked by the observer.
        '[data-chat-flow] [data-dsh-trace="1"] { display: none !important; }',
        // Settings row (sits in the General section column).
        '.dsh-trace-setting { border-bottom: 1px solid var(--dsw-alias-border-l2); flex-direction: column; gap: 8px; padding: 16px 0; display: flex; }',
        '.dsh-trace-setting label { color: var(--dsw-alias-label-primary); cursor: pointer; align-items: center; gap: 8px; font-size: 14px; line-height: 22px; display: flex; }',
        '.dsh-trace-setting input { accent-color: var(--dsw-alias-state-business-primary, #3b82f6); }',
        // Per-turn toggle injected at the top of the agent output.
        '.dsh-trace-top-toggle { align-self: flex-start; display: inline-flex; align-items: center; gap: 4px; height: 22px; color: var(--dsw-alias-label-tertiary); cursor: pointer; background: transparent; border: none; border-radius: 6px; padding: 0 4px; font-size: 12px; line-height: 22px; font-family: inherit; user-select: none; }',
        '.dsh-trace-top-toggle:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }',
        '.dsh-trace-top-toggle::before { content: "▸"; font-size: 10px; line-height: 22px; transition: transform .12s ease; }',
        '.dsh-trace-top-toggle[aria-expanded="true"]::before { transform: rotate(90deg); }',
      ].join(' ')
      document.head.appendChild(tag)
    }

    var React = require('react')

    // ── persisted preference ──
    var AUTO_KEY = 'dsh.trace-collapse.auto'
    function readAuto() {
      try { return localStorage.getItem(AUTO_KEY) !== '0' } catch (e) { return true }
    }
    function writeAuto(value) {
      try { localStorage.setItem(AUTO_KEY, value ? '1' : '0') } catch (e) { /* ignore */ }
    }

    // ── module-level state + tiny store ──
    var state = {
      autoCollapse: readAuto(), // default ON (checked)
      perTurn: {}, // turnKey -> 'collapsed' | 'expanded' (manual per-turn override)
    }
    var version = 0
    var listeners = new Set()
    function subscribe(fn) {
      listeners.add(fn)
      return function () { listeners.delete(fn) }
    }
    function emit() {
      version += 1
      for (var fn of Array.from(listeners)) fn()
    }

    // React hook: re-render on state change.
    function useStore() {
      var v = React.useState(0)
      React.useEffect(function () {
        return subscribe(function () { v[1](function (x) { return x + 1 }) })
      }, [])
      return v[0]
    }

    // ── collapse decision ──
    function isCollapsed(turnKey) {
      var override = turnKey === null ? undefined : state.perTurn[turnKey]
      if (override === 'collapsed') return true
      if (override === 'expanded') return false
      return state.autoCollapse
    }

    // ── DOM scan: group flow items into turns, mark trace nodes ──
    // Kinds kept visible even when collapsed (user-facing or terminal).
    // Everything else in a completed turn is "trace" and gets hidden.
    var TRACE_KINDS = {
      'tool-call': 1,
      steering: 1,
      'workflow-run': 1,
      context: 1, // 上下文注入 rows (system prompt, skill catalog, ...)
      unknown: 1,
      // non-final 'assistant-step' handled separately below
    }

    // A new turn begins at a user prompt or a user-initiated command row;
    // it ends at a completed-turn footer (turn-tail).
    var TURN_START_KINDS = { user: 1, command: 1, 'command-input': 1 }

    function flowItems(flow) {
      var items = []
      for (var i = 0; i < flow.children.length; i++) {
        var el = flow.children[i]
        if (el.nodeType === 1 && el.hasAttribute('data-chat-flow-kind')) items.push(el)
      }
      return items
    }

    function groupTurns(items) {
      var turns = []
      var turn = []
      for (var i = 0; i < items.length; i++) {
        var kind = items[i].getAttribute('data-chat-flow-kind')
        if (TURN_START_KINDS[kind] === 1) {
          if (turn.length > 0) turns.push(turn)
          turn = []
        }
        turn.push(items[i])
        if (kind === 'turn-tail') {
          turns.push(turn)
          turn = []
        }
      }
      if (turn.length > 0) turns.push(turn)
      return turns
    }

    /** The turn number of a turn group, read from its turn-tail node. */
    function turnKeyOf(turn) {
      for (var i = 0; i < turn.length; i++) {
        if (turn[i].getAttribute('data-chat-flow-kind') !== 'turn-tail') continue
        var tail = turn[i].querySelector('[data-turn-tail]')
        return tail ? tail.getAttribute('data-turn-tail') : null
      }
      return null
    }

    /** Index of the final (closing) assistant step in a turn group. */
    function finalAssistantIdx(turn) {
      var idx = -1
      for (var i = 0; i < turn.length; i++) {
        if (turn[i].getAttribute('data-chat-flow-kind') === 'assistant-step') idx = i
      }
      return idx
    }

    function isTraceNode(el, i, finalIdx) {
      var kind = el.getAttribute('data-chat-flow-kind')
      if (kind === 'assistant-step') return i !== finalIdx
      return TRACE_KINDS[kind] === 1
    }

    function scanTurn(turn) {
      var turnKey = turnKeyOf(turn)
      var completed = turnKey !== null
      var finalIdx = finalAssistantIdx(turn)
      var collapsed = completed && isCollapsed(turnKey)
      for (var i = 0; i < turn.length; i++) {
        var el = turn[i]
        if (isTraceNode(el, i, finalIdx) && collapsed) el.setAttribute('data-dsh-trace', '1')
        else el.removeAttribute('data-dsh-trace')
      }
      return { turnKey, completed }
    }

    // ── per-turn toggle injected at the top of the agent output ──
    function makeToggle(turnKey) {
      var collapsed = isCollapsed(turnKey)
      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'dsh-trace-top-toggle'
      btn.setAttribute('data-turn-key', turnKey === null ? '' : turnKey)
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      btn.textContent = collapsed ? 'Expand trace' : 'Collapse trace'
      btn.addEventListener('click', function () {
        toggleTurn(turnKey)
      })
      return btn
    }

    function syncToggle(btn, turnKey) {
      var collapsed = isCollapsed(turnKey)
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true')
      btn.textContent = collapsed ? 'Expand trace' : 'Collapse trace'
    }

    /**
     * Reconcile the injected top toggles of one flow. Removes toggles whose
     * turn no longer qualifies, repositions existing ones, creates missing.
     */
    function reconcileToggles(flow, items, turns) {
      var needed = [] // { turnKey, anchor }
      for (var t = 0; t < turns.length; t++) {
        var turn = turns[t]
        var turnKey = turnKeyOf(turn)
        if (turnKey === null) continue
        var finalIdx = finalAssistantIdx(turn)
        var anchor = null
        for (var i = 0; i < turn.length; i++) {
          if (isTraceNode(turn[i], i, finalIdx)) { anchor = turn[i]; break }
        }
        if (anchor !== null) needed.push({ turnKey, anchor })
      }
      // Drop stale toggles (turn gone or no longer has trace).
      var toggles = flow.querySelectorAll('.dsh-trace-top-toggle')
      var existing = {}
      for (var i = 0; i < toggles.length; i++) {
        var btn = toggles[i]
        var key = btn.getAttribute('data-turn-key')
        var match = null
        for (var n = 0; n < needed.length; n++) {
          if (needed[n].turnKey === key) { match = needed[n]; break }
        }
        if (match === null) {
          btn.remove()
          continue
        }
        existing[key] = btn
      }
      for (var n = 0; n < needed.length; n++) {
        var req = needed[n]
        var el = existing[req.turnKey]
        if (el === undefined) {
          el = makeToggle(req.turnKey)
          flow.insertBefore(el, req.anchor)
        } else {
          // Keep it directly before its trace anchor.
          if (el.nextElementSibling !== req.anchor) flow.insertBefore(el, req.anchor)
          syncToggle(el, req.turnKey)
        }
      }
    }

    function scanFlow(flow) {
      try {
        var items = flowItems(flow)
        var turns = groupTurns(items)
        for (var t = 0; t < turns.length; t++) scanTurn(turns[t])
        reconcileToggles(flow, items, turns)
      } catch (e) {
        // Never let a transient DOM/React mismatch break the plugin.
        if (typeof console !== 'undefined' && console.warn) console.warn('dsh-trace-collapse: scan skipped', e)
      }
    }

    function applyAll() {
      var flows = document.querySelectorAll('[data-chat-flow]')
      for (var i = 0; i < flows.length; i++) scanFlow(flows[i])
    }

    // ── MutationObserver: re-apply on any chat flow change (streaming, paging) ──
    var raf = null
    function scheduleApply() {
      if (raf !== null) return
      raf = requestAnimationFrame(function () {
        raf = null
        applyAll()
      })
    }
    var observer = null
    function startObserver() {
      if (observer) return
      observer = new MutationObserver(scheduleApply)
      observer.observe(document.body, { childList: true, subtree: true })
      scheduleApply()
    }
    function stopObserver() {
      if (observer) {
        observer.disconnect()
        observer = null
      }
    }

    // ── actions ──
    function setAuto(value) {
      state.autoCollapse = !!value
      writeAuto(state.autoCollapse)
      emit()
      scheduleApply()
    }
    function toggleTurn(turnKey) {
      if (turnKey === null) return
      var collapsed = isCollapsed(turnKey)
      state.perTurn[turnKey] = collapsed ? 'expanded' : 'collapsed'
      emit()
      scheduleApply()
    }

    // ── React components ──

    /** Settings row: default-collapse after final output (default ON). */
    function SettingsRow() {
      useStore()
      return React.createElement('div', { className: 'dsh-trace-setting' },
        React.createElement('label', null,
          React.createElement('input', {
            type: 'checkbox',
            checked: state.autoCollapse,
            onChange: function (e) { setAuto(e.target.checked) },
          }),
          React.createElement('span', null, 'Collapse agent trace by default after final output'),
        ),
      )
    }

    // ── plugin face ──
    var inject = ['slots']

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.slots.inject('settings.general.item', function () {
          return ctx.slots.register(
            { name: 'settings.general.item', id: 'trace-collapse', order: 30, label: function () { return 'Trace' } },
            SettingsRow,
          )
        })
      })
      ctx.effect(function () {
        startObserver()
        return stopObserver
      })
    }

    exports.inject = inject
    exports.apply = apply
    return module.exports
  },
})

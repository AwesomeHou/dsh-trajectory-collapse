/**
 * dsh-trajectory-collapse — Client half (static bundle).
 *
 * A real browser script loaded through the client module system
 * (`window.__ModuleLoader__.load`), NOT a dynamic-plugin sandbox body: it
 * receives `require` (the module table) and runs with browser globals
 * (`document`, `localStorage`, `MutationObserver`, `requestAnimationFrame`)
 * available. The module table's `react` seed supplies React.
 *
 * Feature:
 * - The chat view renders every flow node as `[data-chat-flow-kind="..."]`
 *   inside `[data-chat-flow]`. The "agent trajectory" is the intermediate
 *   work: tool calls, steering, workflow runs, unknown rows, and non-final
 *   assistant (thinking) steps.
 * - When a turn's trajectory is collapsed, those nodes are hidden via a data
 *   attribute + injected CSS, while the user message, the FINAL assistant
 *   output, and the completed-turn footer (turn-tail) always stay visible.
 * - A settings row (`settings.general.item`) exposes "最终输出完毕后默认折叠
 *   Agent 轨迹" (default-collapse after the final output completes) — default
 *   ON, persisted in localStorage.
 * - A session header action (`conversation.session.header.actions`) toggles
 *   collapse-all / expand-all / default.
 * - A per-turn toggle is added to the finalized assistant message's action
 *   strip (`conversation.chat.assistant-actions`), so each completed turn can
 *   be collapsed or expanded on its own.
 *
 * Styling follows the shipped client-bundle pattern: a `<style>` element
 * tagged with this plugin's id.
 */
window.__ModuleLoader__.load({
  id: 'dsh-trajectory-collapse',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    // ── CSS — injected once, tagged for the module system's style bookkeeping ──
    var STYLE_TAG = 'dsh-trajectory-collapse/plugin.css'
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="' + STYLE_TAG + '"]') === null) {
      var tag = document.createElement('style')
      tag.dataset.plugin = 'dsh-trajectory-collapse'
      tag.dataset.pluginCss = STYLE_TAG
      tag.textContent = [
        // Hide trajectory nodes marked by the observer.
        '[data-chat-flow] [data-dsh-traj="1"] { display: none !important; }',
        // Settings row (sits in the General section column).
        '.dsh-traj-setting { border-bottom: 1px solid var(--dsw-alias-border-l2); flex-direction: column; gap: 8px; padding: 16px 0; display: flex; }',
        '.dsh-traj-setting label { color: var(--dsw-alias-label-primary); cursor: pointer; align-items: center; gap: 8px; font-size: 14px; line-height: 22px; display: flex; }',
        '.dsh-traj-setting input { accent-color: var(--dsw-alias-state-business-primary, #3b82f6); }',
        // Global session-header toggle.
        '.dsh-traj-global { box-sizing: border-box; height: 28px; color: var(--dsw-alias-label-secondary); cursor: pointer; background: transparent; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; padding: 0 10px; font-size: 13px; line-height: 26px; white-space: nowrap; }',
        '.dsh-traj-global:hover { background: var(--dsw-alias-interactive-bg-hover); }',
        // Per-turn toggle inside the finalized assistant message's action strip.
        '.dsh-traj-turn { height: 28px; color: var(--dsw-alias-label-tertiary); cursor: pointer; background: transparent; border: none; border-radius: 28px; padding: 0 8px; font-size: 12px; line-height: 28px; white-space: nowrap; }',
        '.dsh-traj-turn:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }',
      ].join(' ')
      document.head.appendChild(tag)
    }

    var React = require('react')

    // ── persisted preference ──
    var AUTO_KEY = 'dsh.trajectory-collapse.auto'
    function readAuto() {
      try { return localStorage.getItem(AUTO_KEY) !== '0' } catch (e) { return true }
    }
    function writeAuto(value) {
      try { localStorage.setItem(AUTO_KEY, value ? '1' : '0') } catch (e) { /* ignore */ }
    }

    // ── module-level state + tiny store ──
    var state = {
      autoCollapse: readAuto(), // default ON (checked)
      globalMode: null, // null | 'collapse' | 'expand'
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
      if (state.globalMode === 'collapse') return true
      if (state.globalMode === 'expand') return false
      var override = turnKey === null ? undefined : state.perTurn[turnKey]
      if (override === 'collapsed') return true
      if (override === 'expanded') return false
      return state.autoCollapse
    }

    // ── DOM scan: group flow items into turns, mark trajectory nodes ──
    // Kinds kept visible even when collapsed (user-facing or terminal).
    // Everything else in a completed turn is "trajectory" and gets hidden.
    var TRAJECTORY_KINDS = {
      'tool-call': 1,
      steering: 1,
      'workflow-run': 1,
      unknown: 1,
      // non-final 'assistant-step' handled separately below
    }

    // A new turn begins at a user prompt or a user-initiated command row;
    // it ends at a completed-turn footer (turn-tail).
    var TURN_START_KINDS = { user: 1, command: 1, 'command-input': 1 }

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

    function applyTurn(turn) {
      var turnKey = null
      var completed = false
      var finalIdx = -1
      for (var i = 0; i < turn.length; i++) {
        var kind = turn[i].getAttribute('data-chat-flow-kind')
        if (kind === 'assistant-step') finalIdx = i
        if (kind === 'turn-tail') {
          completed = true
          var tail = turn[i].querySelector('[data-turn-tail]')
          if (tail) turnKey = tail.getAttribute('data-turn-tail')
        }
      }
      // Only completed turns collapse; a running turn keeps its working steps
      // visible while streaming.
      var collapsed = completed && isCollapsed(turnKey)
      for (var i = 0; i < turn.length; i++) {
        var el = turn[i]
        var k = el.getAttribute('data-chat-flow-kind')
        var isFinal = k === 'assistant-step' && i === finalIdx
        var isTrajectory = TRAJECTORY_KINDS[k] === 1 || (k === 'assistant-step' && !isFinal)
        if (isTrajectory && collapsed) el.setAttribute('data-dsh-traj', '1')
        else el.removeAttribute('data-dsh-traj')
      }
    }

    function applyFlow(flow) {
      var items = Array.prototype.filter.call(flow.children, function (el) {
        return el.nodeType === 1 && el.hasAttribute('data-chat-flow-kind')
      })
      var turns = groupTurns(items)
      for (var i = 0; i < turns.length; i++) applyTurn(turns[i])
    }

    function applyAll() {
      var flows = document.querySelectorAll('[data-chat-flow]')
      for (var i = 0; i < flows.length; i++) applyFlow(flows[i])
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
    function cycleGlobal() {
      if (state.globalMode === null) state.globalMode = 'collapse'
      else if (state.globalMode === 'collapse') state.globalMode = 'expand'
      else state.globalMode = null
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
      return React.createElement('div', { className: 'dsh-traj-setting' },
        React.createElement('label', null,
          React.createElement('input', {
            type: 'checkbox',
            checked: state.autoCollapse,
            onChange: function (e) { setAuto(e.target.checked) },
          }),
          React.createElement('span', null, '最终输出完毕后默认折叠 Agent 轨迹'),
        ),
      )
    }

    /** Session header action: collapse all / expand all / restore default. */
    function HeaderToggle() {
      useStore()
      var label = state.globalMode === 'collapse'
        ? '展开全部轨迹'
        : state.globalMode === 'expand'
          ? '恢复默认'
          : '折叠全部轨迹'
      return React.createElement('button', {
        type: 'button',
        className: 'dsh-traj-global',
        onClick: cycleGlobal,
        title: '折叠/展开当前会话的 Agent 轨迹',
      }, label)
    }

    /** Whether this turn has any trajectory nodes worth a collapse control. */
    function turnHasTrajectory(buttonEl) {
      var tailItem = buttonEl.closest('[data-chat-flow-kind="turn-tail"]')
      if (!tailItem) return false
      // Walk backward from the turn-tail to the previous turn start and look
      // for any trajectory-kind flow item (tool calls, workflow runs, thinking
      // steps, unknown rows).
      var el = tailItem.previousElementSibling
      while (el && el.nodeType === 1) {
        var kind = el.getAttribute('data-chat-flow-kind')
        if (TURN_START_KINDS[kind] === 1) break
        if (TRAJECTORY_KINDS[kind] === 1 || kind === 'assistant-step') return true
        el = el.previousElementSibling
      }
      return false
    }

    /** Per-turn toggle rendered on the finalized assistant message's actions. */
    function TurnToggle() {
      useStore()
      var ref = React.useRef(null)
      var keyState = React.useState(null)
      var visibleState = React.useState(false)
      React.useEffect(function () {
        var el = ref.current
        if (el) {
          var tail = el.closest('[data-turn-tail]')
          if (tail) keyState[1](tail.getAttribute('data-turn-tail'))
          visibleState[1](turnHasTrajectory(el))
        }
      }, [])
      var turnKey = keyState[0]
      if (!visibleState[0]) return null
      var collapsed = turnKey === null ? false : isCollapsed(turnKey)
      return React.createElement('button', {
        type: 'button',
        ref: ref,
        className: 'dsh-traj-turn',
        onClick: function () { toggleTurn(turnKey) },
        title: collapsed ? '展开该轮的 Agent 轨迹' : '折叠该轮的 Agent 轨迹',
      }, collapsed ? '展开轨迹' : '折叠轨迹')
    }

    // ── plugin face ──
    var inject = ['slots']

    function apply(ctx) {
      ctx.effect(function () {
        return ctx.slots.inject('settings.general.item', function () {
          return ctx.slots.register(
            { name: 'settings.general.item', id: 'trajectory-collapse', order: 30, label: function () { return 'Agent 轨迹' } },
            SettingsRow,
          )
        })
      })
      ctx.effect(function () {
        return ctx.slots.inject('conversation.session.header.actions', function () {
          return ctx.slots.register(
            { name: 'conversation.session.header.actions', id: 'trajectory-collapse', order: 30 },
            HeaderToggle,
          )
        })
      })
      ctx.effect(function () {
        return ctx.slots.inject('conversation.chat.assistant-actions', function () {
          return ctx.slots.register(
            { name: 'conversation.chat.assistant-actions', id: 'trajectory-collapse', order: 20 },
            TurnToggle,
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

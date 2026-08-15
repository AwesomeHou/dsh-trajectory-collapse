/**
 * dsh-trajectory-collapse — Host half.
 *
 * A permanent (bundle) plugin whose feature is entirely client-side: collapsing
 * the agent trajectory in the web chat view while always keeping the final
 * output. The Host half exists so the loader row resolves; it declares no
 * services and contributes nothing to the Host runtime.
 */
export default {
  name: 'dsh-trajectory-collapse',
  inject: [],
  apply(ctx) {
    // Intentionally empty: all behavior lives in the client bundle. The apply
    // body is still a real contribution so the loader row stays stable.
  },
}

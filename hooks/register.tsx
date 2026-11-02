import type { Register } from 'claude-code'

export const register: Register = on => {
  on('ui.render', ($, e, next) => next(e))
}

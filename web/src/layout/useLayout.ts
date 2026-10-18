import { useEffect, useReducer, useRef, useState } from 'react'
import { layoutReducer, loadLayout, saveLayout } from './model'

/** The viewer's layout: loaded once, saved on every change. If storage is unavailable the layout still
 * works and `saved` turns false, so the UI can say it will not be remembered. */
export function useLayout() {
  const [initial] = useState(() => loadLayout())
  const [layout, dispatch] = useReducer(layoutReducer, initial.layout)
  const [saved, setSaved] = useState(true)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setSaved(saveLayout(layout))
  }, [layout])

  return { layout, dispatch, saved, notes: initial.notes }
}

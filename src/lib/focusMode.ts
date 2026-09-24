import { useSyncExternalStore } from 'react'

/**
 * «Ocultar paneles»: esconde la barra lateral y la lista de apuntes para que el apunte (y sus
 * dibujos) ocupen todo el ancho de la pantalla. Se recuerda en este navegador.
 */

const KEY = 'ocultar-paneles'
const listeners = new Set<() => void>()

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

let hidden = read()

export function setPanelsHidden(value: boolean) {
  hidden = value
  try {
    localStorage.setItem(KEY, value ? '1' : '0')
  } catch {
    /* sin almacenamiento: dura hasta recargar */
  }
  listeners.forEach((l) => l())
}

export function usePanelsHidden(): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => hidden,
  )
  return [value, setPanelsHidden]
}

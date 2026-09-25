import { afterEach, describe, expect, it } from 'vitest'
import { isCameraScanningSupported } from './qr-camera-scanner'

/**
 * Solo `isCameraScanningSupported` se prueba acá: es la única función de
 * este módulo que no toca `qr-scanner` ni hardware real. `startQrCameraScanner`
 * queda sin test unitario directo a propósito — es la costura que los tests
 * de `use-qr-camera-scanner` mockean entera (`vi.mock`), y correr la
 * librería real (canvas, web worker, `getUserMedia`) contra jsdom no
 * probaría nada que jsdom pueda simular de verdad.
 */
describe('isCameraScanningSupported', () => {
  function setSecureContext(value: boolean) {
    Object.defineProperty(window, 'isSecureContext', { value, configurable: true })
  }

  function setMediaDevices(value: MediaDevices | undefined) {
    Object.defineProperty(navigator, 'mediaDevices', { value, configurable: true })
  }

  afterEach(() => {
    setSecureContext(true)
    setMediaDevices({} as MediaDevices)
  })

  it('acepta un contexto seguro con mediaDevices disponible', () => {
    setSecureContext(true)
    setMediaDevices({} as MediaDevices)

    expect(isCameraScanningSupported()).toBe(true)
  })

  it('rechaza un contexto inseguro (HTTP en una IP de red local, no localhost)', () => {
    setSecureContext(false)
    setMediaDevices({} as MediaDevices)

    expect(isCameraScanningSupported()).toBe(false)
  })

  it('rechaza cuando el navegador no expone mediaDevices', () => {
    setSecureContext(true)
    setMediaDevices(undefined)

    expect(isCameraScanningSupported()).toBe(false)
  })
})

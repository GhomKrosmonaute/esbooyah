import * as entity from "./entity"

export class Keyboard extends entity.Entity {
  public keysDown: { [key: string]: number } = {}
  public keysJustDown: { [key: string]: boolean } = {}
  public keysJustUp: { [key: string]: boolean } = {}

  private _lastKeysDown: { [key: string]: number } = {}
  private _onKeyDownWrapper = this._onKeyDown.bind(this)
  private _onKeyUpWrapper = this._onKeyUp.bind(this)
  private _onFocusOutWrapper = this._onFocusOut.bind(this)

  _setup() {
    this.entityConfig.app.view.addEventListener(
      "keydown",
      this._onKeyDownWrapper
    )
    this.entityConfig.app.view.addEventListener("keyup", this._onKeyUpWrapper)
    this.entityConfig.app.view.addEventListener(
      "focusout",
      this._onFocusOutWrapper
    )
  }

  _update(frameInfo: entity.FrameInfo) {
    const keyDownSet = Object.keys(this.keysDown)
    const lastKeyDownSet = Object.keys(this._lastKeysDown)

    this.keysJustDown = {}
    for (const key of keyDownSet.filter((k) => !lastKeyDownSet.includes(k)))
      this.keysJustDown[key] = true

    this.keysJustUp = {}
    for (const key of lastKeyDownSet.filter((k) => !keyDownSet.includes(k)))
      this.keysJustUp[key] = true

    this._lastKeysDown = { ...this.keysDown }
  }

  teardown() {
    this.entityConfig.app.view.removeEventListener(
      "keydown",
      this._onKeyDownWrapper
    )
    this.entityConfig.app.view.removeEventListener(
      "keyup",
      this._onKeyUpWrapper
    )
    this.entityConfig.app.view.removeEventListener(
      "focusout",
      this._onFocusOutWrapper
    )
  }

  _onKeyDown(event: KeyboardEvent) {
    event.preventDefault()

    // console.log("key down", event.code);
    this.keysDown[event.code] = this.lastFrameInfo.timeSinceStart
  }

  _onKeyUp(event: KeyboardEvent) {
    event.preventDefault()

    // console.log("key up", event.code);
    delete this.keysDown[event.code]
  }

  _onFocusOut() {
    this.keysDown = {}
  }
}

export const GAMEPAD_DEAD_ZONE = 0.15

export function countGamepads(): number {
  //@ts-ignore
  return _.filter(navigator.getGamepads(), _.identity).length
}

export class Gamepad extends entity.Entity {
  public state: any
  public buttonsDown: { [key: string]: number }
  public buttonsJustDown: { [key: string]: boolean }
  public buttonsJustUp: { [key: string]: boolean }

  private _lastButtonsDown: { [key: string]: number }

  public axes: number[]

  constructor(public gamepadIndex: number) {
    super()
  }

  _setup() {
    this.axes = []

    this.buttonsDown = {}
    this.buttonsJustDown = {}
    this.buttonsJustUp = {}

    this._lastButtonsDown = {}

    this._updateState()
    // TODO: track events of disconnecting gamepads
  }

  _update(frameInfo: entity.FrameInfo) {
    this._updateState()
  }

  _updateState() {
    //@ts-ignore
    this.state = _.filter(navigator.getGamepads(), _.identity)[
      this.gamepadIndex
    ]
    if (!this.state) return // Gamepad must have been disconnected

    this.axes = []
    for (let i = 0; i < this.state.axes.length; i++) {
      this.axes.push(
        Math.abs(this.state.axes[i]) >= GAMEPAD_DEAD_ZONE
          ? this.state.axes[i]
          : 0
      )
    }

    this.buttonsDown = {}
    for (let i = 0; i < this.state.buttons.length; i++) {
      if (this.state.buttons[i].pressed) {
        if (!this.buttonsDown[i])
          this.buttonsDown[i] = this.lastFrameInfo.timeSinceStart
      } else {
        delete this.buttonsDown[i]
      }
    }

    const buttonDownSet = Object.keys(this.buttonsDown)
    const lastButtonDownSet = Object.keys(this._lastButtonsDown)

    this.buttonsJustDown = {}
    for (const button of buttonDownSet.filter(
      (item) => !lastButtonDownSet.includes(item)
    ))
      this.buttonsJustDown[button] = true

    this.buttonsJustUp = {}
    for (const button of lastButtonDownSet.filter(
      (item) => !buttonDownSet.includes(item)
    ))
      this.buttonsJustUp[button] = true

    this._lastButtonsDown = { ...this.buttonsDown }
  }
}

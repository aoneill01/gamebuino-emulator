import { SercomRegister } from "./sercom-register";
import { PortRegister } from "./port-register";

export class Buttons {
    private _portA: PortRegister;
    private _portB: PortRegister;
    private _sercom: SercomRegister;

    private _buttonData: number;

    private _keymap = [
        [83, 40], // down
        [65, 81, 37], // left
        [68, 39], // right
        [87, 90, 38], // up
        [74], // A
        [75], // B
        [85], // MENU
        [73]  // HOME
    ];

    constructor(sercom: SercomRegister, portA: PortRegister, portB: PortRegister) {
        this._portA = portA;
        this._portB = portB;
        this._sercom = sercom;

        this._buttonData = 0xff; // nothing pressed

        sercom.registerDataListener(this.setButtonData.bind(this));

        document.addEventListener('keydown', (event) => {
            for (var i = 0; i < this._keymap.length; i++) {
                for (var code of this._keymap[i]) {
                    if (code == event.keyCode) {
                        // Stop normal behavior of this button
                        event.preventDefault();
                        // Set the correct bit to 0
                        this._buttonData &= (~(1 << i));
                        break;
                    }
                }
            }
        });

        document.addEventListener('keyup', (event) => {
            for (var i = 0; i < this._keymap.length; i++) {
                for (var code of this._keymap[i]) {
                    if (code == event.keyCode) {
                        // Set the correct bit to 1
                        this._buttonData |= (1 << i);
                        break;
                    }
                }
            }
        });
    }

    setButtonData() {
        if ((this._portB.getOut() & (1 << 3)) != 0) return;

        this._sercom.data = this._buttonData;
    }

    setKeymap(keymap: number[][]) {
        this._keymap = keymap;
    }

    customButtonData(buttonData: number) {
        this._buttonData = buttonData;
    }
}

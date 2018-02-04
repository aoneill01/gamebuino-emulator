import { SercomRegister } from "./sercom-register";
import { PortRegister } from "./port-register";

export class Buttons {
    private _portA: PortRegister;
    private _portB: PortRegister;
    private _sercom: SercomRegister;

    private _buttonData: number;

    private _keymap = [
        68, // down
        83, // left
        70, // right
        69, // up
        75, // A
        76, // B
        82, // MENU
        84  // HOME
    ];

    constructor(sercom: SercomRegister, portA: PortRegister, portB: PortRegister) {
        this._portA = portA;
        this._portB = portB;
        this._sercom = sercom;

        this._buttonData = 0xff; // nothing pressed

        sercom.registerDataListener(this.setButtonData.bind(this));

        document.addEventListener('keydown', (event) => {
            for (var i = 0; i < this._keymap.length; i++) {
                if (this._keymap[i] == event.keyCode) {
                    // Stop normal behavior of this button
                    event.preventDefault();
                    // Set the correct bit to 0
                    this._buttonData &= (~(1 << i));
                    break;
                }
            }
        });

        document.addEventListener('keyup', (event) => {
            for (var i = 0; i < this._keymap.length; i++) {
                if (this._keymap[i] == event.keyCode) {
                    // Set the correct bit to 1
                    this._buttonData |= (1 << i);
                    break;
                }
            }
        });
    }

    setButtonData() {
        if ((this._portB.getOut() & (1 << 3)) != 0) return;

        this._sercom.data = this._buttonData;
    }

    setKeymap(keymap) {
        this._keymap = keymap;
    }
}

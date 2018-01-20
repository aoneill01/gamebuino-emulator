import { SercomRegister } from "./sercom-register";
import { PortRegister } from "./port-register";

export class Buttons {
    private _portA: PortRegister;
    private _portB: PortRegister;
    private _sercom: SercomRegister;

    private _buttonData: number;

    constructor(sercom: SercomRegister, portA: PortRegister, portB: PortRegister) {
        this._portA = portA;
        this._portB = portB;
        this._sercom = sercom;

        this._buttonData = 0xff; // nothing pressed

        sercom.registerDataListener(this.setButtonData.bind(this));

        document.addEventListener('keydown', (event) => {
            switch (event.keyCode) {
                // down
                case 68: this._buttonData &= (~(1 << 0)); break;
                // left
                case 83: this._buttonData &= (~(1 << 1)); break;
                // right
                case 70: this._buttonData &= (~(1 << 2)); break;
                // up
                case 69: this._buttonData &= (~(1 << 3)); break;
                // A
                case 75: this._buttonData &= (~(1 << 4)); break;
                // B
                case 76: this._buttonData &= (~(1 << 5)); break;
                // Menu
                case 82: this._buttonData &= (~(1 << 6)); break;
            }
        });
        document.addEventListener('keyup', (event) => {
            switch (event.keyCode) {
                // down
                case 68: this._buttonData |= (1 << 0); break;
                // left
                case 83: this._buttonData |= (1 << 1); break;
                // right
                case 70: this._buttonData |= (1 << 2); break;
                // up
                case 69: this._buttonData |= (1 << 3); break;
                // A
                case 75: this._buttonData |= (1 << 4); break;
                // B
                case 76: this._buttonData |= (1 << 5); break;
                // Menu
                case 82: this._buttonData |= (1 << 6); break;
            }
        });
    }

    setButtonData() {
        if ((this._portB.getOut() & (1 << 3)) != 0) return;

        this._sercom.data = this._buttonData;
    }
}

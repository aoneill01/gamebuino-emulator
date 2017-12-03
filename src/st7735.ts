import { SercomRegister } from "./sercom-register";
import { PortRegister } from "./port-register";

export class St7735 {
    _port: PortRegister;

    constructor(sercom: SercomRegister, port: PortRegister) {
        this._port = port;
        
        sercom.registerDataListener(this.byteReceived.bind(this));
    }

    byteReceived(value: number) {
        // Test if command or data
        if (this._port.getOut() & 0b1000000) {
            console.log(`Data    ${value.toString(16)}`);
        }
        else {
            console.log(`Command ${value.toString(16)}`);
        }
    }
}
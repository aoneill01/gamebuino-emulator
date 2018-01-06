import { SercomRegister } from "./sercom-register";
import { PortRegister } from "./port-register";

const CASET: number = 0x2a; // Column address set command
const RASET: number = 0x2b; // Row address set command
const RAMWR: number = 0x2c; // Memory write command

export class St7735 {
    private _port: PortRegister;
    private _xStart: number;
    private _xEnd: number;
    private _yStart: number;
    private _yEnd: number;
    private _x: number;
    private _y: number;

    private _ctx: CanvasRenderingContext2D;

    private _argIndex: number;
    private _lastCommand: number;
    private _tmpData: number;

    constructor(sercom: SercomRegister, port: PortRegister, ctx?: CanvasRenderingContext2D) {
        this._port = port;
        this._ctx = ctx;

        sercom.registerDataListener(this.byteReceived.bind(this));
    }

    byteReceived(value: number) {
        // console.log(this._port.getOut().toString(2));
        // Test if command or data
        if (this._port.getOut() & 0b100000000000000000000000) {
            
            console.log(`Data    ${value.toString(16)}`);
            switch (this._lastCommand) {
                case RAMWR:
                    if (this._argIndex % 2 == 0) {
                        this._tmpData = value;
                    }
                    else {
                        var pixelData = ((this._tmpData << 8) | value);
                        var r = ((0b1111100000000000 & pixelData) >>> 8);
                        var g = ((0b0000011111100000 & pixelData) >>> 3);
                        var b = ((0b0000000000011111 & pixelData) << 3);

                        console.log(`set pixel (${this._x}, ${this._y})`);
                        if (this._ctx) {
                            this._ctx.fillStyle = "rgba("+r+","+g+","+b+",255)";
                            this._ctx.fillRect(this._x, this._y, 1, 1);
                        }

                        this._x++;
                        if (this._x > this._xEnd) {
                            this._x = this._xStart;
                            this._y++;
                            if (this._y > this._yEnd) {
                                this._y = this._yStart;
                            }
                        }
                    }
                    break;
                case CASET:
                    if (this._argIndex == 1) {
                        this._xStart = this._x = value;
                    }
                    else if (this._argIndex == 3) {
                        this._xEnd = value;
                    }
                    break;
                case RASET:
                    if (this._argIndex == 1) {
                        this._yStart = this._y = value;
                    }
                    else if (this._argIndex == 3) {
                        this._yEnd = value;
                    }
                    break;
                default:
                    // not implemented command
                    break;
            }
            this._argIndex++;
            
        }
        else {
            console.log(`Command ${value.toString(16)}`);
            this._lastCommand = value;
            this._argIndex = 0;
        }
    }
}
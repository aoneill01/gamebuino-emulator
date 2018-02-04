import { SercomRegister } from "./sercom-register";
import { PortRegister } from "./port-register";

const CASET: number = 0x2a; // Column address set command
const RASET: number = 0x2b; // Row address set command
const RAMWR: number = 0x2c; // Memory write command

const WIDTH: number = 160; // Screen width in pixels
const HEIGHT: number = 128; // Screen height in pixels
const SCALE: number = 2; // Scaling for drawing to canvas

export class St7735 {
    private _portA: PortRegister;
    private _portB: PortRegister;
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

    private _imageData: ImageData;
    private _buf8: Uint8ClampedArray;
    private _data: Uint32Array;

    constructor(sercom: SercomRegister, portA: PortRegister, portB: PortRegister, ctx?: CanvasRenderingContext2D) {
        this._portA = portA;
        this._portB = portB;
        this._ctx = ctx;

        sercom.registerDataListener(this.byteReceived.bind(this));

        if (ctx) {
            this._imageData = ctx.getImageData(0, 0, WIDTH * SCALE, HEIGHT * SCALE);

            var buf = new ArrayBuffer(this._imageData.data.length);
            this._buf8 = new Uint8ClampedArray(buf);
            this._data = new Uint32Array(buf);
        }
    }

    byteReceived(value: number) {
        // if ((this._portA.getOut() & (1 << 17)) == 0) return;
        if ((this._portB.getOut() & (1 << 22)) != 0) return;
        // console.log(this._port.getOut().toString(2));
        // Test if command or data
        // TODO configuration of port for data/command select.
        if (this._portB.getOut() & 0b100000000000000000000000) {
            // console.log(`Data    ${value.toString(16)}`);
            switch (this._lastCommand) {
                case RAMWR:
                    if (this._argIndex % 2 == 0) {
                        this._tmpData = value;
                    }
                    else {
                        // console.log(`set pixel (${this._x}, ${this._y})`);
                        if (this._ctx) {
                            var pixelData = ((this._tmpData << 8) | value);
                            var r = ((0b1111100000000000 & pixelData) >>> 8);
                            var g = ((0b0000011111100000 & pixelData) >>> 3);
                            var b = ((0b0000000000011111 & pixelData) << 3);
                            var color = (255 << 24) |    // alpha
                                        (b << 16) |    // blue
                                        (g <<  8) |    // green
                                        r;            // red
                            var baseIndex = SCALE * (this._y * WIDTH * SCALE + this._x);

                            this._data[baseIndex] = color;
                            this._data[baseIndex + 1] = color;
                            this._data[baseIndex + WIDTH * SCALE] = color;
                            this._data[baseIndex + 1 + WIDTH * SCALE] = color;
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
                        // console.log(`(${this._xStart}, ${this._yStart}) - (${this._xEnd}, ${this._yEnd})`);
                    }
                    break;
                default:
                    // not implemented command
                    break;
            }
            this._argIndex++;
            
        }
        else {
            // console.log(`Command ${value.toString(16)}`);
            this._lastCommand = value;
            this._argIndex = 0;
        }
    }

    updateCanvas() {
        if (this._ctx) {
            this._imageData.data.set(this._buf8);
            this._ctx.putImageData(this._imageData, 0, 0);
        }
    }

    clear() {
        // Set every pixel to black
        for (var i = 0; i < this._data.length; i++) {
            this._data[i] = (255 << 24);
        }
    }
}
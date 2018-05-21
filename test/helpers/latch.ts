export class Lock {
    latch: Promise<any>;
    unlock!: Function;

    constructor() {
        this.latch = new Promise((resolve) => {
            this.unlock = resolve;
        });
    }
}